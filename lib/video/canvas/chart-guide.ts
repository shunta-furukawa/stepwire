import type { ChartGuide, GuideDifficulty } from '../chart-guide';
import type { DrawContext } from './draw';
import { color, difficulty, font } from '../../design/tokens';
import { FOOT_BLOBS, isFootCircle } from '../../vendor/step-analyzer/difficulty';
import { wrapText } from './text';

type Context = Pick<DrawContext, 'ctx' | 'images'>;

export function drawGuideJacket(d: Context, guide: ChartGuide, x: number, y: number, size: number) {
  const { ctx } = d;
  ctx.save();
  ctx.fillStyle = color.deep; ctx.fillRect(x, y, size, size);
  const image = d.images.get(guide.jacket.src);
  if (image) {
    const w = 'width' in image ? Number(image.width) : size;
    const h = 'height' in image ? Number(image.height) : size;
    const scale = Math.min(size / w, size / h);
    ctx.drawImage(image, x + (size - w * scale) / 2, y + (size - h * scale) / 2, w * scale, h * scale);
  }
  ctx.strokeStyle = difficulty[guide.difficulty]; ctx.lineWidth = size * 0.025;
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

export function drawGuideBadge(d: Context, guide: GuideDifficulty, x: number, y: number, size: number, side = '') {
  const { ctx } = d;
  const labels = { BEGINNER: '習', BASIC: '楽', DIFFICULT: '踊', EXPERT: '激', CHALLENGE: '鬼' };
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = difficulty[guide.difficulty];
  ctx.font = `800 ${size}px ${font.display}`;
  const label = `${side ? `${side} ` : ''}${labels[guide.difficulty]}`;
  ctx.fillText(label, x, y);
  const left = x + ctx.measureText(label).width + size * 0.25;
  ctx.save(); ctx.translate(left, y); ctx.scale(size / 28, size / 28);
  for (const blob of FOOT_BLOBS) {
    ctx.beginPath();
    if (isFootCircle(blob)) ctx.arc(blob.cx, blob.cy, blob.r, 0, Math.PI * 2);
    else ctx.ellipse(blob.cx, blob.cy, blob.rx, blob.ry, blob.rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillText(guide.level, left + size * 0.95, y);
  ctx.restore();
}

/** Persistent identity replaces the generic episode heading during song discussion. */
export function drawSongIdentity(d: DrawContext, guide: ChartGuide) {
  const { ctx, width: w, height: h } = d;
  const u = Math.min(w, h) / 1080;
  const x = 64 * u, y = 104 * u, size = 132 * u;
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,9,.92)'; ctx.fillRect(x - 12 * u, y - 10 * u, w - 104 * u, size + 20 * u);
  drawGuideJacket(d, guide, x, y, size);
  const tx = x + size + 28 * u, tw = w - tx - 64 * u;
  let fontSize = 54 * u;
  let lines: string[];
  do {
    ctx.font = `400 ${fontSize}px ${font.impact}`;
    lines = wrapText(guide.title, tw, t => ctx.measureText(t).width);
    if (lines.length * fontSize * 1.05 <= 78 * u && lines.every(t => ctx.measureText(t).width <= tw)) break;
    fontSize *= 0.92;
  } while (fontSize > 14 * u);
  ctx.fillStyle = color.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, tx, y + i * fontSize * 1.05));
  drawGuideBadge(d, guide, tx, y + 90 * u, 30 * u, guide.comparison ? 'A' : '');
  if (guide.comparison) drawGuideBadge(d, guide.comparison, tx + 230 * u, y + 90 * u, 30 * u, 'B');
  ctx.restore();
}
