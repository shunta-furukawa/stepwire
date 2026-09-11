import type { DrawContext } from './draw';
import type { ChartPlayback } from '../chart-model';
import { chartFrame } from '../chart-playback';
import { ARROW_ROTATIONS, FOOT_COLORS, QUANT_COLORS, tickOf } from '../../vendor/step-analyzer/chart';
import { drawArrow, drawGhostArrow, drawFootBadge } from '../../vendor/step-analyzer/arrowCanvas';
import { ARROW_PATH } from '../../vendor/step-analyzer/arrowShape';
import { color, font } from '../../design/tokens';

/** Original analyzer arrow artwork and 3D scene, composited at the video frame time. */
export function drawChart(d: DrawContext, playback: ChartPlayback, box: { x: number; y: number; w: number; h: number }) {
  const { ctx } = d;
  const { clip } = playback;
  const state = chartFrame(playback, d.frame, d.fps ?? 30);
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.beginPath(); ctx.rect(0, 0, box.w, box.h); ctx.clip();
  ctx.fillStyle = color.deep; ctx.fillRect(0, 0, box.w, box.h);
  const u = Math.min(box.w / 900, box.h / 480);
  const labelSize = Math.max(16, 25 * u);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.font = `700 ${labelSize}px ${font.display}`;
  ctx.fillStyle = color.fg;
  ctx.fillText(clip.title, 14 * u, 10 * u, box.w - 28 * u);
  ctx.font = `600 ${labelSize * 0.8}px ${font.mono}`;
  ctx.fillStyle = color.accent;
  ctx.fillText(`${playback.mode === 'focus' ? '注目リプレイ' : '踏み順'} · ${state.rate}× · ${Math.floor(state.beat / 4) + 1}小節`, 14 * u, 45 * u);
  const size = Math.min(box.w * 0.43 / 4 / 1.08, 68 * u);
  // Original arrow rims occupy about 1.06 times their nominal size.
  // Space by the artwork width, so all four lanes nearly touch.
  const cell = size * 1.08;
  const laneW = cell * 4;
  const laneX = 25 * u + (box.w * 0.43 - laneW) / 2;
  const top = 92 * u;
  const bottom = box.h - 38 * u;
  const receptor = top + 30 * u;
  const perBeat = Math.max(22 * u, (bottom - receptor) / 5 * clip.hispeed);
  ctx.save(); ctx.beginPath(); ctx.rect(laneX - 8 * u, top, laneW + 16 * u, bottom - top); ctx.clip();
  for (let p = 0; p < 4; p++) {
    const x = laneX + (p + 0.5) * cell;
    ctx.strokeStyle = color.lineStrong; ctx.lineWidth = u;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.save(); ctx.translate(x, receptor); ctx.rotate((ARROW_ROTATIONS[p] ?? 0) * Math.PI / 180);
    ctx.scale(size / 64, size / 64); ctx.translate(-32, -33);
    const path = new Path2D(ARROW_PATH);
    const hit = state.hit && clip.chart.events[state.index]?.panels.includes(p);
    const foot = hit ? state.step?.feet[p] : null;
    ctx.fillStyle = foot ? FOOT_COLORS[foot] : 'rgba(255,255,255,0.05)'; ctx.fill(path);
    ctx.strokeStyle = hit ? '#ffffff' : '#5a6390'; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke(path); ctx.restore();
  }
  for (let beat = Math.max(0, Math.floor(state.beat / 4) * 4); beat <= state.beat + (bottom - receptor) / perBeat; beat += 4) {
    const y = receptor + (beat - state.beat) * perBeat;
    ctx.strokeStyle = color.lineStrong; ctx.beginPath(); ctx.moveTo(laneX, y); ctx.lineTo(laneX + laneW, y); ctx.stroke();
  }
  for (const hold of clip.chart.holds) {
    const y1 = receptor + (Math.max(hold.startBeat, state.beat) - state.beat) * perBeat;
    const y2 = receptor + (hold.endBeat - state.beat) * perBeat;
    if (y2 < top || y1 > bottom) continue;
    const start = clip.chart.events.findIndex((ev) => ev.row.beat === hold.startBeat && ev.panels.includes(hold.panel));
    const foot = clip.footsteps[start]?.feet[hold.panel];
    ctx.fillStyle = hold.roll ? '#ff9f43' : foot ? FOOT_COLORS[foot] : '#2ecc71';
    ctx.fillRect(laneX + (hold.panel + 0.5) * cell - size / 6, y1, size / 3, y2 - y1);
  }
  // Start near the current note; only paint the visible slice.
  for (let i = Math.max(0, state.index); i < clip.chart.events.length; i++) {
    const ev = clip.chart.events[i];
    if (!ev) continue;
    const y = receptor + (ev.row.beat - state.beat) * perBeat;
    if (y > bottom + size) break;
    if (y < receptor - size / 2) continue;
    const feet = clip.footsteps[i]?.feet;
    if (ev.shock) {
      ctx.strokeStyle = color.accent; ctx.lineWidth = 4 * u; ctx.strokeRect(laneX, y - size / 2, laneW, size);
      ctx.fillStyle = color.fg; ctx.font = `700 ${labelSize}px ${font.mono}`; ctx.fillText('SHOCK', laneX + 6 * u, y - size / 2);
    }
    for (const p of ev.panels) {
      const x = laneX + (p + 0.5) * cell;
      if (ev.ghostPanels.includes(p)) drawGhostArrow(ctx, x, y, size, ARROW_ROTATIONS[p] ?? 0);
      else drawArrow(ctx, x, y, size, ARROW_ROTATIONS[p] ?? 0, QUANT_COLORS[ev.row.quant] ?? color.fg);
      const foot = feet?.[p];
      if (foot) {
        ctx.save(); ctx.translate(x + size * 0.35, y - size * 0.35); ctx.scale(size / 58, size / 58);
        drawFootBadge(ctx, 0, 0, foot, false); ctx.restore();
      }
      if (clip.highlights.includes(tickOf(ev.row.beat))) {
        ctx.strokeStyle = color.accent; ctx.lineWidth = 3 * u; ctx.strokeRect(x - size / 2 - 3 * u, y - size / 2 - 3 * u, size + 6 * u, size + 6 * u);
      }
    }
  }
  for (const mine of clip.chart.mines) {
    const y = receptor + (mine.beat - state.beat) * perBeat;
    if (y < receptor - size || y > bottom) continue;
    ctx.fillStyle = color.fg; ctx.font = `700 ${size}px ${font.mono}`;
    ctx.fillText('×', laneX + (mine.panel + 0.5) * cell - size / 2, y - size / 2);
  }
  ctx.restore();
  const stageBox = { x: box.w * 0.49, y: top - 24 * u, w: box.w * 0.50, h: bottom - top + 28 * u };
  if (d.chartStage) {
    const canvas = d.chartStage.render(playback, d.frame, d.fps ?? 30, stageBox.w, stageBox.h);
    ctx.drawImage(canvas, stageBox.x, stageBox.y, stageBox.w, stageBox.h);
  } else {
    ctx.fillStyle = color.muted; ctx.font = `600 ${labelSize}px ${font.mono}`;
    ctx.fillText('3Dステップを準備中…', stageBox.x, stageBox.y + stageBox.h / 2, stageBox.w);
  }
  const comment = Object.entries(clip.comments).find(([tick]) => Math.floor(Number(tick) / 192) === Math.floor(state.beat / 4))?.[1];
  if (comment) { ctx.fillStyle = color.accent; ctx.fillText(comment, 14 * u, box.h - 30 * u, box.w - 28 * u); }
  ctx.restore();

}
