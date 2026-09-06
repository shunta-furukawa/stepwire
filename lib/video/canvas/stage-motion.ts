import type { DrawContext } from './draw';
import type { Scene } from '../scenes';
import { visibleUnits } from '../reveal';
import { color } from '../../design/tokens';
import type { Speaker } from '../../content/dialogue';

/** Frame-derived motion: seeking and exporting never depend on wall time. */
export function stagePerformance(d: Pick<DrawContext, 'frame' | 'fps'>, scene: Scene, who: Speaker = 'WIRE') {
  const t = Math.max(0, d.frame) / (d.fps ?? 30);
  const reveal = scene.reveal;
  const talking = scene.speaker === who && !!reveal &&
    visibleUnits(reveal, d.frame) > visibleUnits(reveal, Math.max(0, d.frame - (d.fps ?? 30) * 0.12));
  const phase = (t + scene.index * 0.71) % 4.3;
  return { t, talking, blink: phase > 3.95 && phase < 4.10,
    mouth: talking ? 3 + 9 * Math.abs(Math.sin(t * 15)) : 0 };
}

/** Face coordinates are registered to the 1672 × 941 blank illustrated plate. */
export function drawWireExpression(d: DrawContext, scene: Scene, artY: number, artH: number) {
  const { ctx } = d;
  const { t, blink, mouth } = stagePerformance(d, scene);
  const mood = scene.speaker === 'WIRE' ? scene.mood ?? 'neutral' : 'neutral';
  ctx.save();
  ctx.translate(0, artY);
  ctx.scale(d.width / 1672, artH / 941);
  ctx.strokeStyle = color.accent;
  ctx.fillStyle = color.accent;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = color.accent;
  ctx.shadowBlur = 5;
  for (const [i, x, y, rx, ry] of [[0, 295, 472, 34, 38], [1, 434, 408, 24, 38]] as const) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.23);
    const closed = blink || (mood === 'wink' && i === 0);
    if (closed || mood === 'grin') {
      ctx.beginPath();
      ctx.moveTo(-rx * 0.8, 4);
      ctx.quadraticCurveTo(0, closed ? 8 : -ry, rx * 0.8, 4);
      ctx.stroke();
    } else {
      const height = mood === 'think' ? ry * 0.45 : mood === 'surprise' ? ry * 1.1 : ry;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, height, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#080b05';
      const gaze = mood === 'think' ? -5 : 5 + 2 * Math.sin(t * 0.7);
      ctx.beginPath();
      ctx.ellipse(gaze, mood === 'think' ? -3 : -6, rx * (mood === 'surprise' ? 0.28 : 0.45), height * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5ffe3';
      ctx.beginPath(); ctx.arc(gaze - 3, -height * 0.42, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.translate(383, 490);
  ctx.rotate(-0.23);
  ctx.beginPath();
  if (mood === 'surprise') {
    ctx.ellipse(0, 0, 9, 12 + mouth * 0.3, 0, 0, Math.PI * 2);
  } else if (mood === 'think') {
    ctx.moveTo(-16, 4); ctx.lineTo(-4, -2); ctx.lineTo(8, 3); ctx.lineTo(19, -2);
  } else {
    ctx.moveTo(-18, -2);
    ctx.quadraticCurveTo(0, (mood === 'grin' ? 20 : 8) + mouth, 20, -4);
    if (mouth > 0 || mood === 'grin') { ctx.lineTo(-18, -2); }
  }
  ctx.stroke();
  ctx.restore();
}

/** Restore the existing GPU field and add sparse orbiting facets behind copy. */
export function drawStageMotion(d: DrawContext, scene: Scene, artY: number, artH: number, protectCharacters = true) {
  const { ctx, width: w, height: h } = d;
  const { t } = stagePerformance(d, scene);
  const u = Math.min(w, h) / 1080;
  ctx.save();
  // Protect both character silhouettes. Effects remain on the scenery, even
  // in portrait, and later title/photo/dialogue layers stay fully readable.
  if (protectCharacters) {
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(w * 0.06, artY + artH * 0.19, w * 0.36, artH * 0.64);
    ctx.rect(w * 0.55, artY + artH * 0.20, w * 0.42, artH * 0.63);
    ctx.clip('evenodd');
  }
  if (d.field) {
    ctx.globalAlpha = 0.75;
    ctx.drawImage(d.field, 0, 0, w, h);
  }
  ctx.strokeStyle = color.accent;
  ctx.lineWidth = 1.4 * u;
  // These light 2D accents also supply motion when WebGL is unavailable.
  for (let i = 0; i < 18; i++) {
    const phase = t * (0.025 + (i % 4) * 0.006) + i * 0.618;
    const x = w * (0.05 + ((i * 0.381966) % 0.90));
    const y = artY + artH * (0.24 + (phase % 0.46));
    const size = (8 + (i % 5) * 8) * u;
    ctx.save();
    ctx.globalAlpha = 0.14 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.2 + i));
    ctx.translate(x, y); ctx.rotate(t * 0.16 + i);
    ctx.beginPath();
    ctx.moveTo(0, -size); ctx.lineTo(size * 0.8, size * 0.6);
    ctx.lineTo(-size * 0.7, size * 0.4); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  // An assembling diamond and orbiting sparks in the negative center space.
  ctx.translate(w * 0.5, artY + artH * 0.49);
  const radius = w * 0.09;
  ctx.rotate(t * 0.10);
  ctx.globalAlpha = 0.20;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const a = i * Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const a = t * 0.32 + i * Math.PI * 2 / 7;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = i % 3 ? color.accent : color.fg;
    ctx.fillRect(Math.cos(a) * radius, Math.sin(a) * radius, 3 * u, 3 * u);
  }
  ctx.restore();
}
