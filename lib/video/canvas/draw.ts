import { SCENE_TONE, type Scene, type SceneType } from '../scenes';
import type { MediaRef } from '../../content/schema';
import { visibleUnits } from '../reveal';
import { barFractions, difficultyLabel, formatBarValue, formatScore } from '../../content/figures';
import { visualLength } from '../text';
import { color, difficulty, flareEx, font, fontSize, tracking } from '../../design/tokens';
import { typedLines, wrapText } from './text';
import { backdropDim, backdropZoom, sceneGround } from '../ground';
import { drawMono, drawWire } from './face';

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
  /** Frames per second, for motion that is written in seconds (a blink). */
  fps?: number;
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
  const wordmarkEnd = x + step + ctx.measureText('WIRE').width;

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
  // A 9:16 frame has no room for `SESSION · 2026.09.03` beside the wordmark,
  // so the meta drops back to its first segment rather than run into it.
  const room = width - px(120) - (wordmarkEnd + px(48));
  const shown = textWidth > room && text.includes(' · ') ? (text.split(' · ')[0] ?? text) : text;
  const shownWidth = [...shown].reduce((total, char) => total + ctx.measureText(char).width + spacing, 0);
  ctx.fillStyle = color.muted;
  drawTracked(ctx, shown, width - px(120) - shownWidth, y, spacing);
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
function layoutBody(
  d: DrawContext,
  text: string,
  size: number,
  weight = 500,
  measure?: number,
  family: string = font.display,
) {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const x = px(120);
  // A 16:9 frame is wider than its measure should be; the DOM caps it at 82%.
  const maxWidth = measure ?? Math.min(width - x * 2, width * (width > height ? 0.82 : 1));

  ctx.font = fontOf(weight, size, family);
  const lines = wrapText(text, maxWidth, (line) => ctx.measureText(line).width);
  // The impact face carries its own air; the text faces need the lead.
  const lineHeight = size * (family === font.impact ? 1.18 : 1.35);
  return { text, lines, lineHeight, x, size, weight, family, blockHeight: lines.length * lineHeight };
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
  ctx.font = fontOf(layout.weight, layout.size, layout.family);
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
  // The headline is set in the impact face, which has one weight; asking
  // for 900 would only have the browser embolden it.
  const weight = isHeadline ? 400 : 500;
  const family = isHeadline ? font.impact : font.display;
  let bodySize = wanted;
  let body = scene.text ? layoutBody(d, scene.text, bodySize, weight, panel?.measure, family) : null;
  while (body && body.blockHeight > room && bodySize > wanted * 0.6) {
    bodySize = Math.max(wanted * 0.6, bodySize * 0.92);
    body = layoutBody(d, scene.text!, bodySize, weight, panel?.measure, family);
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

/** The width `drawChip` will take for `text` at `size`, for centring one. */
function chipWidth(d: DrawContext, text: string, size: number) {
  const px = scaled(d.width, d.height);
  d.ctx.font = fontOf(700, size, font.mono);
  const chars = [...text];
  return chars.reduce((t, ch) => t + d.ctx.measureText(ch).width, 0) + size * tracking.wide * (chars.length - 1) + px(36);
}

/**
 * One turn of the conversation, staged.
 *
 * Both faces are on every card — WIRE at the left, MONO at the right, facing
 * each other across the bottom of the stage — and the words arrive in a
 * speech bubble with its tail on whoever is talking. The listener dims. The
 * bubble is a rectangle with a straight tail, like everything else on the
 * card: the brand has no radius, and a rounded bubble would be the one
 * thing on the film drawn in a different hand.
 *
 * The bubble pops in over the first frames from its tail, as a function of
 * the frame; the copy then types inside it on the shared reveal plan. A
 * picture takes its panel as on a body card, and the stage is what is left.
 */
const drawTurn: Drawer = (d, scene) => {
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const landscape = width > height;
  const band = contentBand(d);
  const panel = scene.image ? drawPanel(d, scene.image) : null;
  const top = panel?.top ?? band.top;
  const bottom = band.bottom;
  const speaker = scene.speaker ?? 'WIRE';
  const t = d.frame / (d.fps ?? 30);

  const stage = { x: px(120), w: panel?.measure ?? width - px(240) };

  // The face row, along the bottom of the stage.
  const faceSize = px(landscape ? 160 : 184);
  const nameSize = px(fontSize.small * 3);
  const noteSize = px(fontSize.micro * 3);
  const faceRow = faceSize + px(14) + nameSize + px(16) + px(10) + noteSize;
  const faceTop = bottom - faceRow;
  const wireX = stage.x;
  const monoX = stage.x + stage.w - faceSize;

  let cursor = top;
  if (scene.label) cursor += drawLabelChip(d, scene.label, 'analysis', cursor) + px(28);

  // The bubble: as tall as the words, sat on its tail above the faces.
  const pad = px(44);
  const tail = px(30);
  const bubbleX = stage.x;
  const bubbleW = stage.w;
  const bubbleBottom = faceTop - tail - px(10);
  const roomForText = bubbleBottom - cursor - pad * 2;
  const wanted = px(fontSize.h4 * 3);
  let bodySize = wanted;
  let body = scene.text ? layoutBody(d, scene.text, bodySize, 500, bubbleW - pad * 2) : null;
  while (body && body.blockHeight > roomForText && bodySize > wanted * 0.55) {
    bodySize = Math.max(wanted * 0.55, bodySize * 0.92);
    body = layoutBody(d, scene.text ?? '', bodySize, 500, bubbleW - pad * 2);
  }
  const bubbleH = (body?.blockHeight ?? px(80)) + pad * 2;
  const bubbleTop = Math.max(cursor, bubbleBottom - bubbleH);

  const speakerCx = (speaker === 'WIRE' ? wireX : monoX) + faceSize / 2;
  const apexY = faceTop - px(4);
  const ink = speaker === 'WIRE' ? color.accent : color.fg;

  // The pop, from the tail: a bubble that scales up from where the voice is
  // reads as spoken; one that fades in reads as a caption.
  const pop = easeOutBack(Math.min(1, d.frame / 9), 0.6);
  ctx.save();
  ctx.globalAlpha = Math.min(1, d.frame / 5);
  ctx.translate(speakerCx, apexY);
  ctx.scale(pop, pop);
  ctx.translate(-speakerCx, -apexY);

  ctx.fillStyle = color.surface;
  ctx.fillRect(bubbleX, bubbleTop, bubbleW, bubbleBottom - bubbleTop);
  ctx.beginPath();
  ctx.moveTo(speakerCx - px(26), bubbleBottom);
  ctx.lineTo(speakerCx, apexY);
  ctx.lineTo(speakerCx + px(26), bubbleBottom);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1, px(3));
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(speakerCx - px(26), bubbleBottom);
  ctx.lineTo(bubbleX, bubbleBottom);
  ctx.lineTo(bubbleX, bubbleTop);
  ctx.lineTo(bubbleX + bubbleW, bubbleTop);
  ctx.lineTo(bubbleX + bubbleW, bubbleBottom);
  ctx.lineTo(speakerCx + px(26), bubbleBottom);
  ctx.lineTo(speakerCx, apexY);
  ctx.closePath();
  ctx.stroke();

  if (body) paintBody(d, { ...body, x: bubbleX + pad }, bubbleTop + pad, color.fg, scene);
  ctx.restore();

  // The faces. The one talking is lit; the one listening is dimmed.
  const listener = 0.42;
  ctx.globalAlpha = speaker === 'WIRE' ? 1 : listener;
  drawWire(ctx, wireX, faceTop, faceSize, scene.mood ?? 'neutral', t);
  ctx.globalAlpha = speaker === 'MONO' ? 1 : listener;
  drawMono(ctx, monoX, faceTop, faceSize);
  ctx.globalAlpha = 1;

  const nameY = faceTop + faceSize + px(14);
  for (const who of ['WIRE', 'MONO'] as const) {
    const cx = (who === 'WIRE' ? wireX : monoX) + faceSize / 2;
    ctx.globalAlpha = who === speaker ? 1 : listener;
    const w = chipWidth(d, who, nameSize);
    drawChip(d, who, cx - w / 2, nameY, who === 'WIRE' ? color.accent : color.fg, color.onAccent, nameSize);
    if (who === 'WIRE') {
      ctx.font = fontOf(400, noteSize, font.mono);
      ctx.fillStyle = color.faint;
      ctx.textBaseline = 'alphabetic';
      drawTrackedCentred(ctx, 'ASSISTANT AI', cx, nameY + nameSize + px(16) + px(10) + noteSize * 0.8, noteSize * tracking.wider);
    }
  }
  ctx.globalAlpha = 1;
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

      // Flare, rank, then score, from the right edge in.
      let right = x + w;
      if (item.flare) {
        ctx.font = fontOf(700, px(fontSize.small * 3) * 0.85, font.mono);
        const flareLabel = `FLARE ${item.flare}`;
        const flareWidth = ctx.measureText(flareLabel).width;
        ctx.fillStyle = item.flare === 'EX' ? rainbow(ctx, right - flareWidth, flareWidth) : color.faint;
        ctx.fillText(flareLabel, right - flareWidth, mid);
        right -= flareWidth + px(24);
      }
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

  // A timeline is a road, not a list: a rail across the card with a node
  // per moment, the version names as the big type, and the rail lighting up
  // to the highlighted node as the card plays. Landscape runs it across;
  // portrait runs it down. A list of four lines on a black card read as
  // empty; the same four moments spaced along a rail read as a history.
  const items = figure.items;
  const landscape = width > height;
  const lit = Math.max(0, items.findIndex((item) => item.highlight));
  const grow = easeOutCubic(stepAt(d.progress, 0.05, 0.6));
  const atSize = px(fontSize[landscape ? 'h3' : 'h4'] * 3);
  const labelSize = px(fontSize.base * 3);
  const noteSize = px(fontSize.small * 3);
  const node = px(18);

  if (landscape) {
    const railY = top + (bottom - top) * 0.5;
    const inset = px(140);
    const step = items.length > 1 ? (w - inset * 2) / (items.length - 1) : 0;
    const column = Math.max(step, px(360)) - px(40);
    const nodeX = (i: number) => x + inset + step * i;

    // The rail, then the lit part growing along it to the highlighted node.
    ctx.fillStyle = color.lineStrong;
    ctx.fillRect(x, railY - px(3), w, px(6));
    const litTo = nodeX(0) + (nodeX(lit) - nodeX(0)) * grow;
    ctx.fillStyle = color.accent;
    ctx.fillRect(nodeX(0), railY - px(3), Math.max(0, litTo - nodeX(0)), px(6));

    items.forEach((item, i) => {
      const reveal = easeOutCubic(stepAt(d.progress, 0.08 + i * 0.12, 0.25));
      if (reveal <= 0) return;
      const cx = nodeX(i);
      const on = item.highlight || litTo >= cx - px(2);
      ctx.globalAlpha = reveal;

      // The node: a diamond, in the accent once the rail has reached it;
      // the highlighted one wears a ring that breathes with the frame.
      ctx.save();
      ctx.translate(cx, railY);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = on ? color.accent : color.lineStrong;
      ctx.fillRect(-node / 2, -node / 2, node, node);
      if (item.highlight) {
        const ring = node * (1.9 + 0.25 * Math.sin(d.frame / 5));
        ctx.strokeStyle = color.accentHot;
        ctx.lineWidth = px(3);
        ctx.strokeRect(-ring / 2, -ring / 2, ring, ring);
      }
      ctx.restore();

      // The moment, above the rail, in the big type; the words below it.
      ctx.textAlign = 'center';
      ctx.font = fontOf(900, atSize, font.display);
      ctx.fillStyle = item.highlight ? color.accent : color.fg;
      ctx.fillText(item.at, cx, railY - px(48) - (1 - reveal) * px(20));

      ctx.font = fontOf(item.highlight ? 700 : 500, labelSize, font.display);
      ctx.fillStyle = color.fg;
      const lines = wrapText(item.label, column, (line) => ctx.measureText(line).width);
      let ly = railY + px(48) + labelSize;
      for (const line of lines) {
        ctx.fillText(line, cx, ly);
        ly += labelSize * 1.3;
      }
      if (item.note) {
        ctx.font = fontOf(400, noteSize, font.mono);
        ctx.fillStyle = color.faint;
        for (const line of wrapText(item.note, column, (line) => ctx.measureText(line).width)) {
          ly += noteSize * 0.2;
          ctx.fillText(line, cx, ly);
          ly += noteSize * 1.35;
        }
      }
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    });
    return;
  }

  // Portrait: the rail runs down the left, the moments beside it.
  const railX = x + px(30);
  const slot = (bottom - top - px(40)) / items.length;
  const nodeY = (i: number) => top + px(20) + slot * i + slot * 0.3;
  ctx.fillStyle = color.lineStrong;
  ctx.fillRect(railX - px(3), nodeY(0), px(6), nodeY(items.length - 1) - nodeY(0));
  const litToY = nodeY(0) + (nodeY(lit) - nodeY(0)) * grow;
  ctx.fillStyle = color.accent;
  ctx.fillRect(railX - px(3), nodeY(0), px(6), Math.max(0, litToY - nodeY(0)));

  items.forEach((item, i) => {
    const reveal = easeOutCubic(stepAt(d.progress, 0.08 + i * 0.12, 0.25));
    if (reveal <= 0) return;
    const cy = nodeY(i);
    const on = item.highlight || litToY >= cy - px(2);
    ctx.globalAlpha = reveal;
    ctx.save();
    ctx.translate(railX, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = on ? color.accent : color.lineStrong;
    ctx.fillRect(-node / 2, -node / 2, node, node);
    if (item.highlight) {
      const ring = node * (1.9 + 0.25 * Math.sin(d.frame / 5));
      ctx.strokeStyle = color.accentHot;
      ctx.lineWidth = px(3);
      ctx.strokeRect(-ring / 2, -ring / 2, ring, ring);
    }
    ctx.restore();

    const tx = railX + px(64);
    const measure = x + w - tx;
    ctx.font = fontOf(900, atSize, font.display);
    ctx.fillStyle = item.highlight ? color.accent : color.fg;
    ctx.fillText(item.at, tx + (1 - reveal) * px(20), cy + atSize * 0.36);
    ctx.font = fontOf(item.highlight ? 700 : 500, labelSize, font.display);
    ctx.fillStyle = color.fg;
    let ly = cy + atSize * 0.36 + px(24) + labelSize;
    for (const line of wrapText(item.label, measure, (line) => ctx.measureText(line).width)) {
      ctx.fillText(line, tx, ly);
      ly += labelSize * 1.3;
    }
    if (item.note) {
      ctx.font = fontOf(400, noteSize, font.mono);
      ctx.fillStyle = color.faint;
      for (const line of wrapText(item.note, measure, (line) => ctx.measureText(line).width)) {
        ctx.fillText(line, tx, ly);
        ly += noteSize * 1.35;
      }
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
/* ---------------------------------------------------------------------------
 * The session card: the opening infographic.
 * ------------------------------------------------------------------------- */

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

function easeOutCubic(t: number) {
  return 1 - (1 - clamp01(t)) ** 3;
}

/**
 * Overshoots a little and settles — a bar that lands, not one that stops.
 * `s` is how far past the mark it goes: the default is the classic back
 * ease; a bubble the width of the stage takes a gentler one, or its
 * overshoot leaves the frame.
 */
function easeOutBack(t: number, s = 1.70158) {
  const c = clamp01(t) - 1;
  return 1 + (s + 1) * c ** 3 + s * c ** 2;
}

/** Where a step that begins at `start` and lasts `span` stands, 0–1. */
function stepAt(progress: number, start: number, span: number) {
  return clamp01((progress - start) / span);
}

/** `text` drawn with tracking, centred on `cx`. */
function drawTrackedCentred(ctx: DrawContext['ctx'], text: string, cx: number, y: number, spacing: number) {
  const chars = [...text];
  const w = chars.reduce((t, ch) => t + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
  drawTracked(ctx, text, cx - w / 2, y, spacing);
}

/** The FLARE EX rainbow across `[x, x + w]`, as a canvas fill. */
function rainbow(ctx: DrawContext['ctx'], x: number, w: number) {
  const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
  flareEx.forEach((stop, i) => gradient.addColorStop(i / (flareEx.length - 1), stop));
  return gradient;
}

/** A small filled chip; returns its width so a row can flow. */
function drawChip(
  d: DrawContext,
  text: string,
  x: number,
  y: number,
  fill: string | 'rainbow',
  ink: string,
  size: number,
) {
  const { ctx } = d;
  const px = scaled(d.width, d.height);
  const padX = px(18);
  const spacing = size * tracking.wide;
  ctx.font = fontOf(700, size, font.mono);
  const chars = [...text];
  const w = chars.reduce((t, ch) => t + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
  const h = size + px(16);
  ctx.fillStyle = fill === 'rainbow' ? rainbow(ctx, x, w + padX * 2) : fill;
  ctx.fillRect(x, y, w + padX * 2, h);
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  drawTracked(ctx, text, x + padX, y + h / 2, spacing);
  ctx.textBaseline = 'alphabetic';
  return w + padX * 2;
}

/**
 * The session as an infographic, in motion.
 *
 * This replaces the headline card when the article declares a session: the
 * thumbnail already said what the video is about, so the film opens on what
 * was played. Every number is one the operator wrote (`session-stats.ts`
 * only counts), and every motion is a function of `d.progress` or `d.frame`:
 * the numbers count up, the bars land with a little overshoot, and a scan
 * line crosses the chart as they do. Nothing here is timed by a clock.
 */
const drawStats: Drawer = (d, scene) => {
  const stats = scene.stats;
  if (!stats) return;
  const { ctx, width, height } = d;
  const px = scaled(width, height);
  const { top, bottom } = contentBand(d);
  const landscape = width > height;
  const left = px(120);
  const right = width - px(120);
  const p = d.progress;

  // Regions. Landscape reads left to right — the session, then its plays;
  // portrait stacks the same blocks top to bottom.
  const headW = landscape ? px(780) : right - left;
  const gutter = px(64);
  const tiles = landscape
    ? { x: left, y: top + px(330), w: headW, h: bottom - top - px(330) }
    : { x: left, y: top + px(340), w: right - left, h: px(420) };
  const chartTop = landscape ? top : tiles.y + tiles.h + px(60);
  // Two chip rows when the plays carry FLARE RANKs; the chart gives up the
  // height rather than the chips running into the rail.
  const chipRows = stats.byFlare.length > 0 ? 2 : 1;
  const chipRow = px(landscape ? 74 : 84);
  const chipsBlock = chipRow * chipRows;
  const chart = landscape
    ? { x: left + headW + gutter, y: chartTop, w: right - (left + headW + gutter), h: bottom - top - px(54) - chipsBlock }
    : { x: left, y: chartTop, w: right - left, h: bottom - chartTop - px(50) - chipsBlock };
  const chipsY = bottom - chipsBlock + px(8);

  /* Head: the date, the day, the window. */
  const dateSize = px(landscape ? 128 : 112);
  const headIn = easeOutCubic(stepAt(p, 0, 0.12));
  ctx.globalAlpha = headIn;
  ctx.font = fontOf(900, dateSize, font.display);
  ctx.fillStyle = color.fg;
  const dateY = top + dateSize * 0.86 + (1 - headIn) * px(36);
  drawTracked(ctx, stats.date, left, dateY, dateSize * tracking.display);

  // Line two: the weekday as a chip, the window, the length counting up.
  const lineIn = easeOutCubic(stepAt(p, 0.06, 0.14));
  ctx.globalAlpha = lineIn;
  const lineSize = px(fontSize.lead * 3);
  const lineY = dateY + px(40) + lineSize;
  let cursor = left;
  cursor += drawChip(d, stats.weekday, cursor, lineY - lineSize * 0.5 - px(8) - lineSize * 0.45, color.accent, color.onAccent, lineSize * 0.7) + px(24);
  ctx.font = fontOf(500, lineSize, font.mono);
  ctx.fillStyle = color.fg;
  if (stats.window) {
    ctx.fillText(stats.window, cursor, lineY);
    cursor += ctx.measureText(stats.window).width + px(28);
  }
  if (stats.minutes !== undefined) {
    const shown = Math.round(stats.minutes * easeOutCubic(stepAt(p, 0.1, 0.4)));
    ctx.fillStyle = color.accent;
    ctx.font = fontOf(900, lineSize, font.mono);
    const value = String(shown);
    ctx.fillText(value, cursor, lineY);
    cursor += ctx.measureText(value).width + px(10);
    ctx.font = fontOf(500, lineSize * 0.6, font.mono);
    ctx.fillStyle = color.muted;
    ctx.fillText('MIN', cursor, lineY);
  }

  // Line three: the conditions, in the operator's words.
  const metaIn = easeOutCubic(stepAt(p, 0.12, 0.14));
  ctx.globalAlpha = metaIn;
  // The conditions are free text and the column is not: the line shrinks a
  // little to fit, then drops its last part (the style, then the venue)
  // rather than run under the chart.
  const meta = [stats.weather, stats.venue, stats.style].filter((part): part is string => Boolean(part));
  let metaSize = px(fontSize.base * 3);
  ctx.fillStyle = color.muted;
  while (meta.length > 0) {
    ctx.font = fontOf(400, metaSize, font.mono);
    if (ctx.measureText(meta.join(' · ')).width <= headW) break;
    if (metaSize > px(fontSize.base * 3) * 0.8) metaSize *= 0.95;
    else meta.pop();
  }
  ctx.fillText(meta.join(' · '), left, lineY + px(24) + metaSize);

  /* Tiles: the session, counted. */
  const cells: { label: string; value: (t: number) => string; unit?: string; badge?: { text: string; hot: boolean } }[] = [
    { label: 'CHARTS', value: (t) => String(Math.round(stats.charts * t)), unit: '曲' },
    {
      label: 'AVG LEVEL',
      value: (t) => (stats.averageLevel === undefined ? '—' : (stats.averageLevel * t).toFixed(1)),
      unit: 'LV',
    },
    { label: 'PERSONAL BEST', value: (t) => String(Math.round(stats.personalBests * t)), unit: 'PB' },
  ];
  if (stats.flare) {
    // With a before, the number rolls from it to the after and the rise is
    // the badge; without one it rolls up from nothing, and the rank name
    // (SUN, EARTH) stands where the unit would.
    const { after, before, delta, rank } = stats.flare;
    const from = before ?? 0;
    cells.push({
      label: 'FLARE SKILL',
      value: (t) => formatScore(Math.round(from + (after - from) * t)),
      ...(rank ? { unit: rank } : {}),
      ...(delta !== undefined
        ? { badge: { text: delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0', hot: delta > 0 } }
        : {}),
    });
  } else if (stats.best) {
    const best = stats.best;
    cells.push({ label: 'BEST SCORE', value: (t) => formatScore(Math.round(best.score * t)) });
  }
  const cols = 2;
  const rows = Math.ceil(cells.length / cols);
  const cellW = (tiles.w - px(40)) / cols;
  const cellH = tiles.h / rows;
  const labelSize = px(fontSize.micro * 3);
  const valueSize = Math.min(px(landscape ? 88 : 104), cellH - labelSize - px(40));
  cells.forEach((cell, i) => {
    const t = stepAt(p, 0.14 + i * 0.07, 0.42);
    if (t <= 0) return;
    const x = tiles.x + (i % cols) * (cellW + px(40));
    const y = tiles.y + Math.floor(i / cols) * cellH;
    ctx.globalAlpha = easeOutCubic(Math.min(1, t * 3));
    ctx.fillStyle = color.lineStrong;
    ctx.fillRect(x, y, cellW, px(2));
    // The rule underlines itself in the accent as the number arrives.
    ctx.fillStyle = color.accent;
    ctx.fillRect(x, y, cellW * easeOutCubic(t), px(2));

    ctx.font = fontOf(700, labelSize, font.mono);
    ctx.fillStyle = color.muted;
    drawTracked(ctx, cell.label, x, y + px(18) + labelSize, labelSize * tracking.wider);

    // The value, its unit and its rise share one row, sized to the tile: a
    // six-figure FLARE SKILL with a rank and a rise does not fit at the size
    // a two-digit count does, and the size is settled before the count-up
    // so the number does not jump when the rise arrives.
    const value = cell.value(easeOutCubic(t));
    const settled = cell.value(1);
    const badgeSize = labelSize * 0.9;
    const badgeText = cell.badge?.text ?? '';
    const badgeChars = [...badgeText];
    ctx.font = fontOf(700, badgeSize, font.mono);
    const badgeW = cell.badge
      ? badgeChars.reduce((total, ch) => total + ctx.measureText(ch).width, 0) +
        badgeSize * tracking.wide * (badgeChars.length - 1) +
        px(36)
      : 0;
    ctx.font = fontOf(900, valueSize, font.mono);
    const settledW = ctx.measureText(settled).width;
    ctx.font = fontOf(500, valueSize * 0.34, font.mono);
    const unitW = cell.unit ? ctx.measureText(cell.unit).width : 0;
    // The gaps and the chip do not scale with the value; only the text does.
    const fixed = (cell.unit ? px(12) : 0) + (cell.badge ? badgeW + px(20) : 0);
    const scaling = settledW + unitW;
    const size =
      scaling + fixed > cellW
        ? Math.max(valueSize * 0.55, valueSize * ((cellW - fixed) / scaling))
        : valueSize;
    const valueY = y + px(18) + labelSize + px(16) + size * 0.86;

    ctx.font = fontOf(900, size, font.mono);
    ctx.fillStyle = color.fg;
    ctx.fillText(value, x, valueY);
    const valueW = ctx.measureText(value).width;
    if (cell.unit) {
      ctx.font = fontOf(500, size * 0.34, font.mono);
      ctx.fillStyle = color.muted;
      ctx.fillText(cell.unit, x + valueW + px(12), valueY);
    }
    if (cell.badge && t >= 1) {
      // A rise pulses; the pulse is a function of the frame, as everything is.
      ctx.globalAlpha = cell.badge.hot ? 0.8 + 0.2 * Math.sin(d.frame / 3) : 1;
      drawChip(
        d,
        cell.badge.text,
        x + cellW - badgeW,
        valueY - badgeSize - px(12),
        cell.badge.hot ? color.accentHot : color.lineStrong,
        cell.badge.hot ? color.onAccent : color.fg,
        badgeSize,
      );
    }
  });
  ctx.globalAlpha = 1;

  /* Chart: one bar per play, in the difficulty's colour. */
  const plays = stats.plays;
  if (plays.length > 0) {
    const titleSize = px(fontSize.micro * 3);
    const titleIn = easeOutCubic(stepAt(p, 0.24, 0.12));

    // The axis floors just under the lowest score of the top three quarters:
    // on a 0–1,000,000 axis every bar is the same height, and a floor under
    // the lowest score lets one abandoned play flatten the rest. Plays under
    // the floor are drawn as dimmed stubs — off the chart, and shown as such.
    const sorted = plays.map((play) => play.score).sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length / 4)] ?? 0;
    const floor = Math.max(0, Math.floor((typical - 1) / 50_000) * 50_000);
    const ceiling = 1_000_000;

    ctx.globalAlpha = titleIn;
    ctx.font = fontOf(700, titleSize, font.mono);
    ctx.fillStyle = color.muted;
    const titleY = chart.y + titleSize;
    const titleW = drawTracked(ctx, 'SCORE', chart.x, titleY, titleSize * tracking.wider);
    ctx.font = fontOf(400, titleSize, font.mono);
    ctx.fillStyle = color.faint;
    ctx.fillText(`${formatScore(floor)} → ${formatScore(ceiling)}`, chart.x + titleW + px(24), titleY);
    ctx.globalAlpha = 1;

    const rankSize = px(fontSize.small * 3);
    const plotTop = chart.y + titleSize + px(96);
    const plotBottom = chart.y + chart.h - rankSize - px(24);
    const plotH = plotBottom - plotTop;

    const slot = chart.w / plays.length;
    const barW = slot * 0.62;
    // Twenty bars leave no room for twenty rank labels: the label shrinks to
    // the slot, and below a readable size it gives way to a mark under the
    // AAA bars alone — the rank that is the point of a session.
    ctx.font = fontOf(700, rankSize, font.mono);
    const rankFit = Math.min(rankSize, (rankSize * slot * 0.9) / Math.max(1, ctx.measureText('AAA').width));
    const rankLabels = rankFit >= px(22);
    plays.forEach((play, i) => {
      const t = stepAt(p, 0.28 + i * 0.035, 0.38);
      if (t <= 0) return;
      const under = play.score < floor;
      const frac = clamp01((play.score - floor) / (ceiling - floor));
      const h = under ? px(10) : Math.max(px(6), plotH * frac * easeOutBack(t));
      const x = chart.x + slot * i + (slot - barW) / 2;
      const y = plotBottom - h;
      ctx.globalAlpha = under ? 0.45 : 1;
      ctx.fillStyle = difficulty[play.difficulty];
      ctx.fillRect(x, y, barW, h);
      ctx.globalAlpha = 1;

      if (play.pb) {
        // The best marked in the hot accent, and blinking: it is the one
        // thing on the card that is news.
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(d.frame / 2.5 + i);
        ctx.fillStyle = color.accentHot;
        ctx.fillRect(x, y - px(12), barW, px(8));
        ctx.font = fontOf(900, rankSize * 0.9, font.mono);
        drawTrackedCentred(ctx, 'PB', x + barW / 2, y - px(24), rankSize * 0.9 * tracking.wide);
        ctx.globalAlpha = 1;
      }

      if (play.rank && rankLabels) {
        ctx.font = fontOf(700, rankFit, font.mono);
        ctx.fillStyle = play.rank === 'AAA' ? color.accent : color.muted;
        ctx.globalAlpha = easeOutCubic(t);
        drawTrackedCentred(ctx, play.rank, x + barW / 2, plotBottom + rankFit + px(4), 0);
        ctx.globalAlpha = 1;
      } else if (play.rank === 'AAA') {
        ctx.fillStyle = color.accent;
        ctx.globalAlpha = easeOutCubic(t);
        ctx.fillRect(x, plotBottom + px(8), barW, px(6));
        ctx.globalAlpha = 1;
      }
    });

    // The baseline, and the scan that crosses the chart while the bars land.
    ctx.fillStyle = color.lineStrong;
    ctx.fillRect(chart.x, plotBottom, chart.w, px(2));
    const scan = stepAt(p, 0.28, 0.45);
    if (scan > 0 && scan < 1) {
      ctx.globalAlpha = 0.5 * Math.sin(scan * Math.PI);
      ctx.fillStyle = color.accent;
      ctx.fillRect(chart.x + chart.w * scan, plotTop - px(20), px(3), plotBottom - plotTop + px(20));
      ctx.globalAlpha = 1;
    }
  }

  /* Chips: the difficulty mix in the game's colours; the FLARE mix below it. */
  const chipRoom = landscape ? chart.w : right - left;
  const chipX0 = landscape ? chart.x : left;
  const drawChipRow = (
    labels: string[],
    y: number,
    startAt: number,
    fillOf: (i: number) => string | 'rainbow',
    inkOf: (i: number) => string,
  ) => {
    // Sized to fit the row: five difficulties on a 9:16 frame would
    // otherwise run off the right edge, and a chip half off the card says
    // nothing.
    let chipSize = px(fontSize.small * 3);
    const widthAt = (size: number) => {
      ctx.font = fontOf(700, size, font.mono);
      return labels.reduce((total, label) => {
        const chars = [...label];
        const w = chars.reduce((t, ch) => t + ctx.measureText(ch).width, 0) + size * tracking.wide * (chars.length - 1);
        return total + w + px(36) + px(14);
      }, 0);
    };
    while (widthAt(chipSize) > chipRoom && chipSize > px(20)) chipSize *= 0.94;
    let chipX = chipX0;
    labels.forEach((label, i) => {
      const t = stepAt(p, startAt + i * 0.06, 0.16);
      if (t <= 0) return;
      ctx.globalAlpha = easeOutCubic(t);
      chipX += drawChip(d, label, chipX, y, fillOf(i), inkOf(i), chipSize) + px(14);
    });
  };
  drawChipRow(
    stats.byDifficulty.map((entry) => `${entry.difficulty} ×${entry.count}`),
    chipsY,
    0.5,
    (i) => difficulty[stats.byDifficulty[i]?.difficulty ?? 'BEGINNER'],
    () => color.onAccent,
  );
  if (stats.byFlare.length > 0) {
    // EX quotes the game's rainbow (`flareEx` in the tokens); the nine
    // lower ranks sit on the palette's grey.
    drawChipRow(
      stats.byFlare.map((entry) => `FLARE ${entry.flare} ×${entry.count}`),
      chipsY + chipRow,
      0.6,
      (i) => (stats.byFlare[i]?.flare === 'EX' ? 'rainbow' : color.lineStrong),
      (i) => (stats.byFlare[i]?.flare === 'EX' ? color.onAccent : color.fg),
    );
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
};

const DRAWERS: Record<SceneType, Drawer> = {
  outro: drawIdent,
  stats: drawStats,
  turn: drawTurn,
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
    drawWireBar(
      d,
      scene.type === 'headline' || scene.type === 'stats'
        ? scene.kicker
        : scene.type === 'source'
          ? undefined
          : scene.label,
    );
  }

  DRAWERS[scene.type](d, scene);
  drawProgressRail(d, scene.index, scene.total);
}
