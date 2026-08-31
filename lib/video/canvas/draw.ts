import { SCENE_TONE, type Scene, type SceneType } from '../scenes';
import { barFractions, formatBarValue } from '../../content/figures';
import { visualLength } from '../text';
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
type Drawer = (d: DrawContext, scene: Scene) => void;

/** The wordmark, centred, with the brand rule assembling under it. */
const drawIdent: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const size = px(fontSize.h1 * 3);

  ctx.font = fontOf(900, size, font.display);
  const step = ctx.measureText('STEP').width;
  const total = step + ctx.measureText('WIRE').width;
  const left = width / 2 - total / 2;

  ctx.fillStyle = color.fg;
  ctx.fillText('STEP', left, height / 2);
  ctx.fillStyle = color.accent;
  ctx.fillText('WIRE', left + step, height / 2);
  ctx.fillRect(left, height / 2 + px(40), total * Math.min(1, d.progress * 2), px(10));

  if (scene.meta) {
    ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
    ctx.fillStyle = color.muted;
    drawTracked(ctx, scene.meta.toUpperCase(), left, height / 2 + px(140), px(4));
  }
};

/** A body card: label chip or accent mark, then copy, centred in the band. */
const drawCard: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const tone = SCENE_TONE[scene.type];
  const { top, bottom } = contentBand(d);

  const isHeadline = scene.type === 'headline';
  const bodySize = px(fontSize[isHeadline ? 'h2' : 'h4'] * 3);
  const body = scene.text ? layoutBody(d, scene.text, bodySize, isHeadline ? 900 : 500) : null;
  const meta = isHeadline && scene.meta ? layoutBody(d, scene.meta, px(fontSize.lead * 2.4), 400) : null;

  const markHeight = isHeadline ? 0 : scene.label ? measureLabelChip(d) : px(8);
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
};

/** The source card. The brand rule above it is the one place it is loud. */
const drawSource: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const { top, bottom } = contentBand(d);

  const body = scene.text ? layoutBody(d, scene.text, px(fontSize.h4 * 3), 500) : null;
  const blockHeight = px(8) + px(60) + px(fontSize.small * 3) + px(40) + (body?.blockHeight ?? 0);
  let cursor = Math.max(top, top + (bottom - top - blockHeight) / 2);

  ctx.fillStyle = color.accent;
  ctx.fillRect(px(120), cursor, width - px(240), px(8));
  cursor += px(60);

  ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
  ctx.fillStyle = color.muted;
  drawTracked(ctx, 'SOURCE', px(120), cursor, px(fontSize.small * 3) * tracking.wider);
  cursor += px(40);

  if (body) cursor += paintBody(d, body, cursor);

  if (scene.meta) {
    ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
    ctx.fillStyle = color.faint;
    drawTracked(ctx, scene.meta, px(120), cursor + px(50), px(4));
  }
};

/**
 * A figure. Draws the declared rows — never anything derived at render time,
 * which is the same rule the page and the DOM video follow.
 */
const drawFigure: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const figure = scene.figure;
  if (!figure) return drawCard(d, scene);

  const { top, bottom } = contentBand(d);
  const x = px(120);
  const w = width - x * 2;
  let cursor = top + px(40);

  if (figure.kind === 'stat') {
    const columns = Math.min(figure.items.length, width > height ? 4 : 2);
    const colWidth = (w - px(48) * (columns - 1)) / columns;
    // One size for the row, fitted to the longest value — the same rule the DOM
    // renderer applies, for the same reason.
    const widest = Math.max(...figure.items.map((item) => visualLength(item.value)));
    const valueSize = Math.min(px(fontSize.h1 * 3), colWidth / Math.max(widest * 0.55, 1));
    const rowHeight = px(fontSize.small * 3) + px(24) + valueSize + px(60);
    cursor = Math.max(top, top + (bottom - top - rowHeight * Math.ceil(figure.items.length / columns)) / 2);

    figure.items.forEach((item, i) => {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const cx = x + col * (colWidth + px(48));
      const cy = cursor + row * rowHeight;
      const reveal = Math.min(1, Math.max(0, d.progress * 3 - i * 0.15));
      if (reveal <= 0) return;

      ctx.globalAlpha = reveal;
      ctx.fillStyle = color.fg;
      ctx.fillRect(cx, cy, colWidth, px(8));
      ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
      ctx.fillStyle = color.muted;
      drawTracked(ctx, item.label, cx, cy + px(60), px(3));
      ctx.font = fontOf(900, valueSize, font.display);
      ctx.fillStyle = color.accent;
      ctx.fillText(item.value, cx, cy + px(60) + valueSize);
      ctx.globalAlpha = 1;
    });
    return;
  }

  if (figure.kind === 'bars') {
    const fractions = barFractions(figure);
    const rowHeight = px(fontSize.base * 3) + px(52);
    cursor = Math.max(top, top + (bottom - top - rowHeight * figure.items.length) / 2);

    figure.items.forEach((item, i) => {
      const reveal = Math.min(1, Math.max(0, d.progress * 3 - i * 0.12));
      if (reveal <= 0) return;
      const y = cursor + i * rowHeight;
      ctx.globalAlpha = reveal;

      const labelSize = px(fontSize[width > height ? 'base' : 'small'] * 3);
      ctx.font = fontOf(item.highlight ? 900 : 500, labelSize, font.display);
      ctx.fillStyle = color.fg;
      ctx.fillText(item.label, x, y + labelSize);

      const value = formatBarValue(figure, item.value);
      ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
      ctx.fillStyle = item.highlight ? color.accent : color.muted;
      const valueWidth = ctx.measureText(value).width;
      ctx.fillText(value, x + w - valueWidth, y + labelSize);

      const barY = y + labelSize + px(14);
      ctx.fillStyle = color.line;
      ctx.fillRect(x, barY, w, px(18));
      // The reveal scales the drawn length; the proportion it settles at is
      // always the true one.
      ctx.fillStyle = item.highlight ? color.accent : color.muted;
      ctx.fillRect(x, barY, w * (fractions[i] ?? 0) * reveal, px(18));
      ctx.globalAlpha = 1;
    });
    return;
  }

  // The `at` column is sized to its widest member, not to a guessed constant:
  // it is free text, and `タイブレーク` is wider than `第1曲` by half again.
  // A fixed width put the longest label through the rail and into the row.
  ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
  const atSpacing = px(fontSize.small * 3) * tracking.wider;
  const atWidth = Math.max(
    ...figure.items.map((item) =>
      [...item.at].reduce((total, char) => total + ctx.measureText(char).width + atSpacing, 0),
    ),
  );
  const railX = x + atWidth + px(56);

  const hasNotes = figure.items.some((item) => item.note);
  const rowHeight = px(fontSize.base * 3) + (hasNotes ? px(56) : 0) + px(56);
  cursor = Math.max(top, top + (bottom - top - rowHeight * figure.items.length) / 2);

  figure.items.forEach((item, i) => {
    const reveal = Math.min(1, Math.max(0, d.progress * 3 - i * 0.12));
    if (reveal <= 0) return;
    const y = cursor + i * rowHeight;
    ctx.globalAlpha = reveal;

    ctx.fillStyle = item.highlight ? color.accent : color.lineStrong;
    ctx.fillRect(railX - px(30), y, px(6), rowHeight - px(16));

    ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
    ctx.fillStyle = item.highlight ? color.accent : color.muted;
    drawTracked(ctx, item.at, x, y + px(fontSize.base * 3), px(3));

    const size = px(fontSize.base * 3);
    ctx.font = fontOf(item.highlight ? 900 : 500, size, font.display);
    ctx.fillStyle = color.fg;
    ctx.fillText(item.label, railX, y + size);

    if (item.note) {
      ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
      ctx.fillStyle = color.faint;
      ctx.fillText(item.note, railX, y + size + px(44));
    }
    ctx.globalAlpha = 1;
  });
};

/**
 * A subtitle page, with the word currently being spoken lit.
 *
 * The tokens carry timings rebased to the start of the scene, so this needs no
 * knowledge of where it sits in the film — the same contract the DOM scene has.
 */
const drawNarration: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const { top, bottom } = contentBand(d);
  if (!scene.text) return;

  const size = px(fontSize[width > height ? 'h3' : 'h4'] * 3);
  const layout = layoutBody(d, scene.text, size, 700);
  const startY = Math.max(top, top + (bottom - top - layout.blockHeight) / 2);

  // Which token is being spoken now, in milliseconds into this page.
  const elapsedMs = d.progress * (scene.durationInFrames / 30) * 1000;
  const spokenUpTo = (scene.tokens ?? []).reduce(
    (chars, token) => (token.toMs <= elapsedMs ? chars + token.text.length : chars),
    0,
  );

  let drawn = 0;
  ctx.font = fontOf(700, size, font.display);
  layout.lines.forEach((line, i) => {
    const y = startY + size + i * layout.lineHeight;
    let cursor = layout.x;
    for (const char of line) {
      // Spoken text is full strength; what is still to come is dimmed. The
      // effect is a read-along, not a highlight box.
      ctx.fillStyle = drawn < spokenUpTo ? color.fg : color.faint;
      ctx.fillText(char, cursor, y);
      cursor += ctx.measureText(char).width;
      drawn += 1;
    }
  });

  if (scene.meta) {
    ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
    ctx.fillStyle = color.accent;
    drawTracked(ctx, scene.meta, layout.x, bottom, px(4));
  }
};

/**
 * Every scene type, drawn.
 *
 * A `Record<SceneType, …>` rather than a switch: adding a scene to the film now
 * fails to compile until the canvas renderer can draw it, which is the only
 * cheap guarantee available that the two renderers stay in step. The
 * alternative — a default case — would silently export a video missing a scene
 * the preview showed.
 */
const DRAWERS: Record<SceneType, Drawer> = {
  intro: drawIdent,
  outro: drawIdent,
  headline: drawCard,
  news: drawCard,
  context: drawCard,
  impact: drawCard,
  figure: drawFigure,
  source: drawSource,
  narration: drawNarration,
};

/** The band content may occupy: below the masthead, above the progress rail. */
function contentBand(d: DrawContext) {
  const px = scaled(d.width, d.height);
  return { top: px(150) + px(80), bottom: d.height - px(150) - px(60) };
}

/**
 * Draws one frame of one scene.
 *
 * Deliberately synchronous and allocation-light: this runs once per frame of
 * the export, so an extra object per call is an extra object per frame.
 */
export function drawScene(d: DrawContext, scene: Scene) {
  const { ctx, width, height } = d;
  const ident = scene.type === 'intro' || scene.type === 'outro';

  ctx.fillStyle = ident || SCENE_TONE[scene.type] === 'fact' ? color.deep : color.raised;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  drawFacets(d);

  if (!ident) drawWireBar(d, scene.type === 'source' ? undefined : scene.label);

  DRAWERS[scene.type](d, scene);
  drawProgressRail(d, scene.index, scene.total);
}
