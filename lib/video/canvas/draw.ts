import { SCENE_TONE, type Scene, type SceneType } from '../scenes';
import type { MediaRef } from '../../content/schema';
import { visibleUnits } from '../reveal';
import { barFractions, difficultyLabel, formatBarValue, formatScore } from '../../content/figures';
import { visualLength } from '../text';
import { color, difficulty, font, fontSize, tracking } from '../../design/tokens';
import { typedLines, wrapText } from './text';
import { backdropDim, backdropZoom, sceneGround } from '../ground';

/**
 * The renderer for STEPWIRE scenes.
 *
 * It draws a `Scene[]` derived from the article — the project's one structural
 * idea applied once more: the article feeds the page and the video, and the
 * scene feeds this. Nothing here is authored; all of it is derived.
 *
 * Why a canvas: a browser cannot encode DOM. Exporting a video on the device
 * means producing pixels the WebCodecs `VideoEncoder` can take, and the only
 * thing in a browser that produces pixels on demand is a canvas. There used to
 * be a DOM renderer beside this one for previewing, and the two could drift;
 * the preview now draws with this, at a frame, so there is nothing to drift.
 *
 * Images are an input, not something this fetches: `DrawContext.images` is a
 * cache the caller fills before the first frame, because a frame renderer that
 * awaits the network is a frame renderer that drops frames.
 */

/**
 * Design units: the web type scale times three, in a 1080-class space.
 *
 * Scaled by the SHORT edge, not the width: a 16:9 frame is constrained by its
 * height, and scaling by width made every glyph 1.78x too large and ran the
 * body copy off the bottom of the frame. Both formats have a 1080 short edge,
 * so this reduces to 1.0 for each.
 */
const BASE_SHORT_EDGE = 1080;

export interface DrawContext {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  /** Progress through this scene, 0 to 1. Drives fades and bar reveals. */
  progress: number;
  /** Frame within this scene. Drives the typed reveal, which is per frame. */
  frame: number;
  /** Decoded images by `src`, loaded by the caller before rendering starts. */
  images: ReadonlyMap<string, CanvasImageSource>;
  /**
   * The particle field for this frame, already rendered (`lib/video/field.ts`).
   * Drawn between the picture and the copy. Optional: a frame without it is
   * a plainer frame, not a broken one.
   */
  field?: CanvasImageSource;
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

/**
 * An image filling the frame, cropped rather than letterboxed, then darkened
 * so type over it stays legible. `dim` is the darkness at the bottom, where
 * the copy sits; the top keeps more of the picture.
 */
function drawBackdrop(d: DrawContext, src: string, dim: number) {
  const { ctx, width, height } = d;
  const image = d.images.get(src);
  if (!image) return false;

  const iw = 'width' in image ? Number(image.width) : width;
  const ih = 'height' in image ? Number(image.height) : height;
  const scale = Math.max(width / iw, height / ih) * backdropZoom(d.progress);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);

  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, `rgba(10,10,11,${dim})`);
  gradient.addColorStop(0.3, `rgba(10,10,11,${dim})`);
  gradient.addColorStop(1, `rgba(10,10,11,${dim * 0.55})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  return true;
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
function layoutBody(d: DrawContext, text: string, size: number, weight = 500, measure?: number) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const x = px(120);
  // A 16:9 frame is wider than its measure should be; the DOM caps it at 82%.
  const maxWidth = measure ?? Math.min(width - x * 2, width * (width > height ? 0.82 : 1));

  ctx.font = fontOf(weight, size, font.display);
  const lines = wrapText(text, maxWidth, (line) => ctx.measureText(line).width);
  const lineHeight = size * 1.35;
  return { text, lines, lineHeight, x, size, weight, blockHeight: lines.length * lineHeight };
}

type BodyLayout = ReturnType<typeof layoutBody>;

/**
 * Paints laid-out copy, typed up to this frame when the scene has a reveal.
 *
 * The lines were wrapped from the FULL text, so what has been typed is drawn
 * by walking the same lines and stopping — the layout never shifts as
 * characters land, which is what makes the effect read as typing rather than
 * as reflowing.
 */
function paintBody(
  d: DrawContext,
  layout: BodyLayout,
  top: number,
  fill: string = color.fg,
  scene?: Scene,
) {
  const { ctx } = d;
  ctx.font = fontOf(layout.weight, layout.size, font.display);
  ctx.fillStyle = fill;

  const limit = scene?.reveal ? visibleUnits(scene.reveal, d.frame) : Number.POSITIVE_INFINITY;
  const done = !scene?.reveal || limit >= scene.reveal.units;
  const shownLines = typedLines(layout.text, layout.lines, limit);

  for (let i = 0; i < shownLines.length; i += 1) {
    const shown = shownLines[i]!;
    const y = top + layout.size + i * layout.lineHeight;
    ctx.fillText(shown, layout.x, y);

    if (!done && i === shownLines.length - 1) {
      // The cursor, blinking, after the last typed character.
      if (Math.floor(d.frame / 4) % 2 === 0) {
        ctx.fillStyle = color.accent;
        ctx.fillRect(layout.x + ctx.measureText(shown).width + layout.size * 0.1, y - layout.size * 0.85, layout.size * 0.08, layout.size);
        ctx.fillStyle = fill;
      }
    }
  }
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

  // The credits, bottom-left above the rail: small, but on the card, because
  // an attribution licence asks for exactly that. The wordmark lifts to make
  // room, so four lines of credit never run into the tagline.
  const creditSize = px(fontSize.micro * 3);
  const creditLead = creditSize * 1.6;
  const credits = scene.credits ?? [];
  const lift = credits.length > 0 ? (credits.length * creditLead) / 2 + px(24) : 0;
  const mid = height / 2 - lift;

  ctx.fillStyle = color.fg;
  ctx.fillText('STEP', left, mid);
  ctx.fillStyle = color.accent;
  ctx.fillText('WIRE', left + step, mid);
  ctx.fillRect(left, mid + px(40), total * Math.min(1, d.progress * 2), px(10));

  if (scene.meta) {
    ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
    ctx.fillStyle = color.muted;
    drawTracked(ctx, scene.meta.toUpperCase(), left, mid + px(140), px(4));
  }

  if (credits.length > 0) {
    ctx.font = fontOf(400, creditSize, font.mono);
    ctx.fillStyle = color.faint;
    ctx.globalAlpha = Math.min(1, d.progress * 3);
    credits.forEach((line, i) => {
      const y = height - px(150) - px(48) - (credits.length - 1 - i) * creditLead;
      drawTracked(ctx, line, px(120), y, px(2));
    });
    ctx.globalAlpha = 1;
  }
};

/**
 * The picture a body card carries, as a panel beside (landscape) or above
 * (portrait) the copy — not behind it. A result photo is the point of the
 * card, so it is shown whole and lit, and the words keep their own ground.
 */
function drawPanel(d: DrawContext, image: MediaRef) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const { top, bottom } = contentBand(d);
  const landscape = width > height;
  const creditSize = px(fontSize.micro * 3);
  const creditRoom = creditSize * 2;

  const panel = landscape
    ? { w: (width - px(240)) * 0.4, h: bottom - top - px(20) - creditRoom }
    : { w: width - px(240), h: (bottom - top) * 0.46 - creditRoom };
  const x = landscape ? width - px(120) - panel.w : px(120);
  const y = top;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, panel.w, panel.h);
  ctx.clip();
  const source = d.images.get(image.src);
  if (source) {
    const iw = 'width' in source ? Number(source.width) : panel.w;
    const ih = 'height' in source ? Number(source.height) : panel.h;
    const scale = Math.max(panel.w / iw, panel.h / ih) * backdropZoom(d.progress);
    ctx.drawImage(source, x + (panel.w - iw * scale) / 2, y + (panel.h - ih * scale) / 2, iw * scale, ih * scale);
  } else {
    ctx.fillStyle = color.raised;
    ctx.fillRect(x, y, panel.w, panel.h);
    ctx.font = fontOf(400, creditSize, font.mono);
    ctx.fillStyle = color.accentHot;
    drawTracked(ctx, `IMAGE MISSING: ${image.src}`, x + px(20), y + panel.h / 2, px(2));
  }
  ctx.restore();

  ctx.strokeStyle = color.lineStrong;
  ctx.lineWidth = Math.max(1, px(2));
  ctx.strokeRect(x, y, panel.w, panel.h);

  ctx.font = fontOf(400, creditSize, font.mono);
  ctx.fillStyle = color.faint;
  drawTracked(ctx, image.credit, x, y + panel.h + creditSize * 1.4, creditSize * tracking.wide);

  return landscape
    ? { measure: x - px(120) - px(56), top, bottom }
    : { measure: undefined, top: y + panel.h + creditRoom + px(20), bottom };
}

/** A body card: label chip or accent mark, then copy, centred in the band. */
const drawCard: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const tone = SCENE_TONE[scene.type];
  const band = contentBand(d);
  const panel = scene.type !== 'headline' && scene.image ? drawPanel(d, scene.image) : null;
  const top = panel?.top ?? band.top;
  const bottom = panel?.bottom ?? band.bottom;

  if (scene.type === 'headline' && scene.image) {
    // Over a picture the masthead is drawn here, after it, so it sits on top.
    drawWireBar(d, scene.kicker);
    if (scene.image.credit) {
      ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
      ctx.fillStyle = color.faint;
      drawTracked(ctx, scene.image.credit, px(120), height - px(150) - px(40), px(3));
    }
  }

  const isHeadline = scene.type === 'headline';
  const meta = isHeadline && scene.meta ? layoutBody(d, scene.meta, px(fontSize.lead * 2.4), 400) : null;

  const markHeight = isHeadline ? 0 : scene.label ? measureLabelChip(d) : px(8);
  const markGap = isHeadline ? 0 : px(60);
  const metaGap = meta ? px(50) : 0;

  // The copy is measured, and shrunk until it fits above the rail. A card
  // that runs through the rail is a broken frame; a card a size smaller is
  // a card. The floor matches `fitBodySize`, which the DOM estimates with.
  const wanted = px(fontSize[isHeadline ? 'h2' : 'h4'] * 3);
  const room = bottom - top - markHeight - markGap - metaGap - (meta?.blockHeight ?? 0);
  let bodySize = wanted;
  let body = scene.text ? layoutBody(d, scene.text, bodySize, isHeadline ? 900 : 500, panel?.measure) : null;
  while (body && body.blockHeight > room && bodySize > wanted * 0.6) {
    bodySize = Math.max(wanted * 0.6, bodySize * 0.92);
    body = layoutBody(d, scene.text!, bodySize, isHeadline ? 900 : 500, panel?.measure);
  }
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

  if (body) cursor += paintBody(d, body, cursor, color.fg, scene);
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

  if (figure.kind === 'plays') {
    // Rows share the band; twelve of them shrink rather than overflow.
    const dense = figure.items.length > 6;
    const size = px(fontSize[dense ? 'small' : 'base'] * 3);
    const rowHeight = Math.min(size + px(dense ? 26 : 44), (bottom - top - px(40)) / figure.items.length);
    cursor = Math.max(top, top + (bottom - top - rowHeight * figure.items.length) / 2);
    const badgeSize = size * 0.62;
    const badgePad = px(14);
    const noteSize = px(fontSize.micro * 3);

    figure.items.forEach((item, i) => {
      const reveal = Math.min(1, Math.max(0, d.progress * 3 - i * 0.1));
      if (reveal <= 0) return;
      const y = cursor + i * rowHeight;
      const mid = y + rowHeight / 2;
      ctx.globalAlpha = reveal;
      ctx.textBaseline = 'middle';

      // The badge, in the game's colour for the difficulty.
      ctx.font = fontOf(700, badgeSize, font.mono);
      const label = difficultyLabel(item);
      const spacing = badgeSize * tracking.wider;
      const labelWidth = [...label].reduce((t, ch) => t + ctx.measureText(ch).width + spacing, 0);
      const badgeHeight = badgeSize + px(12);
      ctx.fillStyle = difficulty[item.difficulty];
      ctx.fillRect(x, mid - badgeHeight / 2, labelWidth + badgePad * 2, badgeHeight);
      ctx.fillStyle = color.onAccent;
      drawTracked(ctx, label, x + badgePad, mid, spacing);

      // Rank, then score, from the right edge in.
      let right = x + w;
      if (item.rank) {
        ctx.font = fontOf(700, px(fontSize.small * 3), font.mono);
        const rankWidth = ctx.measureText(item.rank).width;
        ctx.fillStyle = item.rank === 'AAA' ? color.accent : color.muted;
        ctx.fillText(item.rank, right - rankWidth, mid);
        right -= rankWidth + px(24);
      }
      ctx.font = fontOf(item.highlight ? 700 : 500, size, font.mono);
      ctx.fillStyle = color.fg;
      const score = formatScore(item.score);
      const scoreWidth = ctx.measureText(score).width;
      ctx.fillText(score, right - scoreWidth, mid);
      right -= scoreWidth + px(28);

      // The song and its note, clipped to the room between badge and score.
      const songX = x + labelWidth + badgePad * 2 + px(28);
      ctx.save();
      ctx.beginPath();
      ctx.rect(songX, y, Math.max(0, right - songX), rowHeight);
      ctx.clip();
      ctx.font = fontOf(item.highlight ? 900 : 500, size, font.display);
      ctx.fillStyle = color.fg;
      ctx.fillText(item.song, songX, mid);
      if (item.note) {
        const songWidth = ctx.measureText(item.song).width;
        ctx.font = fontOf(400, noteSize, font.mono);
        ctx.fillStyle = color.muted;
        ctx.fillText(item.note, songX + songWidth + px(20), mid);
      }
      ctx.restore();

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = color.line;
      ctx.fillRect(x, y + rowHeight - px(2), w, px(2));
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
 * A transcript page, typed.
 *
 * This is the operator talking, so it sits on the analysis ground with the
 * accent mark — but it types like every other card. The recording was the
 * script; nothing here is timed to a voice.
 */
const drawNarration: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const { top, bottom } = contentBand(d);
  if (!scene.text) return;

  const size = px(fontSize[width > height ? 'h3' : 'h4'] * 3);
  const layout = layoutBody(d, scene.text, size, 700);
  const markHeight = px(8) + px(60);
  const startY = Math.max(top, top + (bottom - top - layout.blockHeight - markHeight) / 2);

  ctx.fillStyle = color.accent;
  ctx.fillRect(px(120), startY, px(96), px(8));
  paintBody(d, layout, startY + markHeight, color.fg, scene);
};

/**
 * An image the article carries, full-bleed, with its credit.
 *
 * The credit is drawn in the accent and never omitted: a jacket or a post in a
 * published video is a quotation, and the line under it is what makes it one.
 */
const drawImage: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const image = scene.image;
  if (!image) return;

  const shown = d.images.has(image.src);
  drawWireBar(d, image.kind?.toUpperCase());
  if (!shown) {
    // The image failed to load. Say so on the frame rather than export a
    // black card the operator only discovers after posting.
    ctx.font = fontOf(400, px(fontSize.small * 3), font.mono);
    ctx.fillStyle = color.accentHot;
    drawTracked(ctx, `IMAGE MISSING: ${image.src}`, px(120), height / 2, px(3));
  }

  const enter = Math.min(1, d.progress * 4);
  const creditSize = px(fontSize.small * 3);
  const layout = scene.text ? layoutBody(d, scene.text, px(fontSize.h4 * 3), 700) : null;

  // The caption and credit sit on a solid band, not on the picture. A post
  // screenshot always has text near its bottom edge, and a gradient over it
  // was not enough to keep the two apart.
  const pad = px(36);
  const bandHeight = pad + (layout ? layout.blockHeight + px(24) : 0) + creditSize + pad;
  const bandTop = height - px(150) - px(40) - bandHeight;
  ctx.globalAlpha = enter * 0.92;
  ctx.fillStyle = color.deep;
  ctx.fillRect(0, bandTop, width, bandHeight);
  ctx.globalAlpha = enter;
  ctx.fillStyle = color.accent;
  ctx.fillRect(px(120), bandTop, px(8), bandHeight);

  let y = bandTop + pad;
  if (layout) {
    layout.x += px(36);
    paintBody(d, layout, y - layout.size * 0.15, color.fg);
    y += layout.blockHeight + px(24);
  }
  ctx.font = fontOf(400, creditSize, font.mono);
  ctx.fillStyle = color.accent;
  drawTracked(ctx, image.credit, px(120) + px(36), y + creditSize * 0.8, creditSize * tracking.wider);
  ctx.globalAlpha = 1;
};

/**
 * Every scene type, drawn.
 *
 * A `Record<SceneType, …>` rather than a switch: adding a scene to the film
 * fails to compile until the renderer can draw it. The alternative — a default
 * case — would silently export a video with a scene missing.
 */
const DRAWERS: Record<SceneType, Drawer> = {
  outro: drawIdent,
  headline: drawCard,
  news: drawCard,
  context: drawCard,
  impact: drawCard,
  figure: drawFigure,
  source: drawSource,
  narration: drawNarration,
  image: drawImage,
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
  const ident = scene.type === 'outro';
  // The stack under every card, in the order `lib/video/ground.ts` fixes:
  // ground, picture, field, copy. Scenes over a picture draw the masthead
  // themselves, after it, so it sits on top.
  const dim = backdropDim(scene);
  const ownsBackdrop = dim !== null;

  ctx.fillStyle = sceneGround(scene);
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  if (dim !== null && scene.image) drawBackdrop(d, scene.image.src, dim);
  else drawFacets(d);
  // Sparks in front of the world and behind the words.
  if (d.field) ctx.drawImage(d.field, 0, 0, width, height);

  if (!ident && !ownsBackdrop) {
    drawWireBar(d, scene.type === 'headline' ? scene.kicker : scene.type === 'source' ? undefined : scene.label);
  }

  DRAWERS[scene.type](d, scene);
  drawProgressRail(d, scene.index, scene.total);
}
