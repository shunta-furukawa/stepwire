import type { DrawContext } from './draw';
import type { Scene } from '../scenes';
import { color, font } from '../../design/tokens';
import { visibleUnits } from '../reveal';
import { typedLines, wrapText } from './text';
import { ANIMATED_CONVERSATION_PLATE, CONVERSATION_PLATE, CONVERSATION_SCENERY, CONVERSATION_CHARACTERS } from './images';
import { drawStageMotion, drawWireExpression } from './stage-motion';
import { drawConversationActors } from './stage-actors';
import { drawChart } from './chart';

/** The art contains no copy or result data. Every label remains article-driven. */
export function drawIllustratedTurn(d: DrawContext, scene: Scene): boolean {
  const animatedArt = d.images.get(ANIMATED_CONVERSATION_PLATE);
  const scenery = d.images.get(CONVERSATION_SCENERY);
  const actors = d.images.get(CONVERSATION_CHARACTERS);
  // Never show an empty set if only one of the new layers loaded.
  const layered = !!scenery && !!actors;
  const art = layered ? scenery : animatedArt ?? d.images.get(CONVERSATION_PLATE);
  if (!art) return false;
  const { ctx, width: w, height: h } = d;
  const landscape = w > h;
  const u = Math.min(w, h) / 1080;
  const margin = 64 * u;
  const speaker = scene.speaker ?? 'WIRE';
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color.deep;
  ctx.fillRect(0, 0, w, h);

  // Portrait keeps both people in view instead of cropping to the empty center.
  const artY = landscape ? 0 : h * 0.22;
  const artH = landscape ? h : w * 9 / 16;
  ctx.drawImage(art, 0, artY, w, artH);
  drawStageMotion(d, scene, artY, artH, !layered);
  if (!layered && animatedArt) drawWireExpression(d, scene, artY, artH);
  const shade = ctx.createLinearGradient(0, 0, 0, landscape ? h * 0.28 : artY);
  shade.addColorStop(0, 'rgba(0,0,0,.7)');
  shade.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, landscape ? h * 0.28 : artY);

  ctx.font = `900 ${42 * u}px ${font.display}`;
  ctx.fillStyle = color.fg;
  ctx.fillText('STEP', margin, 34 * u);
  const stepW = ctx.measureText('STEP').width;
  ctx.fillStyle = color.accent;
  ctx.fillText('WIRE', margin + stepW, 34 * u);
  ctx.font = `600 ${25 * u}px ${font.mono}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = color.fg;
  ctx.fillText(scene.label ?? 'SESSION', w - margin, 44 * u);
  ctx.textAlign = 'left';

  fitText(scene.stageTitle ?? scene.label ?? 'MONO × WIRE', margin, 108 * u,
    w - margin * 2, landscape ? h * 0.13 : h * 0.13, landscape ? 74 * u : 60 * u,
    font.impact, color.fg);

  // The existing quoted result stays intact; never synthesize score-screen pixels.
  let creditY: number | undefined;
  if (scene.image && !scene.chartPlayback) {
    const media = d.images.get(scene.image.src);
    const box = landscape
      ? layered
        ? { x: w * 0.25, y: h * 0.225, w: w * 0.50, h: h * 0.50 }
        : { x: w * 0.36, y: h * 0.28, w: w * 0.28, h: h * 0.40 }
      : { x: margin, y: artY + artH * 0.79, w: w - margin * 2, h: h * 0.21 };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.8)';
    ctx.shadowBlur = 24 * u;
    ctx.fillStyle = 'rgba(0,0,0,.88)';
    ctx.fillRect(box.x - 10 * u, box.y - 10 * u, box.w + 20 * u, box.h + 55 * u);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color.accent;
    ctx.lineWidth = 2 * u;
    ctx.strokeRect(box.x - 10 * u, box.y - 10 * u, box.w + 20 * u, box.h + 55 * u);
    if (media) {
      const iw = 'width' in media ? Number(media.width) : box.w;
      const ih = 'height' in media ? Number(media.height) : box.h;
      const s = Math.min(box.w / iw, box.h / ih);
      ctx.drawImage(media, box.x + (box.w - iw * s) / 2, box.y, iw * s, ih * s);
    } else {
      fitText('画像を読み込めませんでした', box.x, box.y, box.w, box.h, 28 * u, font.display, color.muted);
    }
    creditY = box.y + box.h + 10 * u;
    ctx.restore();
  } else if (landscape && !scene.chartPlayback) {
    ctx.fillStyle = color.accent;
    ctx.fillRect(w * 0.43, h * 0.46, w * 0.14, 5 * u);
    ctx.font = `700 ${26 * u}px ${font.mono}`;
    ctx.textAlign = 'center';
    ctx.fillText('MONO × WIRE', w / 2, h * 0.49);
    ctx.textAlign = 'left';
  }

  // Foreground actors overlap the media frame; text panels stay above all art.
  if (layered && actors) drawConversationActors(d, scene, actors, artY, artH);
  if (scene.chartPlayback) {
    const box = landscape
      ? { x: w * 0.25, y: h * 0.235, w: w * 0.50, h: h * 0.46 }
      : { x: margin, y: artY + artH * 0.79, w: w - margin * 2, h: h * 0.23 };
    drawChart(d, scene.chartPlayback, box);
  }
  if (scene.image && creditY !== undefined) {
    ctx.textAlign = 'center';
    fitText(scene.image.credit, w / 2, creditY, landscape ? w * 0.24 : w - margin * 2,
      28 * u, 21 * u, font.mono, color.fg);
    ctx.textAlign = 'left';
  }

  // Keep both names visible, but attach the dialogue and highlight only to its speaker.
  const dialogueY = landscape ? h * 0.765 : h * 0.77;
  const dialogueH = h - dialogueY - 84 * u;
  const notch = 22 * u;
  ctx.fillStyle = 'rgba(8,8,9,.96)';
  ctx.strokeStyle = speaker === 'WIRE' ? color.accent : color.fg;
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(margin + notch, dialogueY);
  ctx.lineTo(w - margin - notch, dialogueY);
  ctx.lineTo(w - margin, dialogueY + notch);
  ctx.lineTo(w - margin, dialogueY + dialogueH - notch);
  ctx.lineTo(w - margin - notch, dialogueY + dialogueH);
  ctx.lineTo(margin + notch, dialogueY + dialogueH);
  ctx.lineTo(margin, dialogueY + dialogueH - notch);
  ctx.lineTo(margin, dialogueY + notch);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const labelY = dialogueY - 47 * u;
  for (const who of ['WIRE', 'MONO'] as const) {
    const nameX = who === 'WIRE' ? margin + 8 * u : w - margin - 115 * u;
    ctx.fillStyle = who === speaker ? (who === 'WIRE' ? color.accent : color.fg) : color.muted;
    ctx.font = `800 ${30 * u}px ${font.mono}`;
    ctx.fillText(who, nameX, labelY);
    if (who === speaker) ctx.fillRect(nameX, labelY + 35 * u, 100 * u, 4 * u);
  }
  ctx.font = `500 ${20 * u}px ${font.mono}`;
  ctx.fillStyle = color.fg;
  ctx.fillText('ASSISTANT AI', margin + 118 * u, labelY + 7 * u);

  const full = scene.text ?? '';
  let size = landscape ? 49 * u : 44 * u;
  const textW = w - margin * 2 - 64 * u;
  const textH = dialogueH - 38 * u;
  let lines: string[];
  // Fit complete copy before revealing it so line positions never jump as it types.
  do {
    ctx.font = `500 ${size}px ${font.display}`;
    lines = wrapText(full, textW, (s) => ctx.measureText(s).width);
    if (lines.length * size * 1.34 <= textH && lines.every((s) => ctx.measureText(s).width <= textW)) break;
    size *= 0.94;
  } while (size > 12 * u);
  const limit = scene.reveal ? visibleUnits(scene.reveal, d.frame) : [...full].length;
  ctx.fillStyle = color.fg;
  typedLines(full, lines, limit).forEach((line, i) => ctx.fillText(line, margin + 32 * u, dialogueY + 20 * u + i * size * 1.34));

  const railW = w - margin * 2;
  const gap = 8 * u;
  const total = Math.max(1, scene.total);
  const segment = (railW - gap * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i === scene.index ? color.accent : i < scene.index ? color.fg : color.lineStrong;
    ctx.fillRect(margin + i * (segment + gap), h - 38 * u, segment, 5 * u);
  }
  ctx.restore();
  return true;

  function fitText(text: string, x: number, y: number, maxW: number, maxH: number, startSize: number, family: string, ink: string) {
    let size = startSize;
    let rows: string[];
    do {
      ctx.font = `400 ${size}px ${family}`;
      rows = wrapText(text, maxW, (s) => ctx.measureText(s).width);
      if (rows.length * size * 1.2 <= maxH && rows.every((s) => ctx.measureText(s).width <= maxW)) break;
      size *= 0.92;
    } while (size > 10 * u);
    ctx.fillStyle = ink;
    rows.forEach((row, i) => ctx.fillText(row, x, y + i * size * 1.2));
  }
}
