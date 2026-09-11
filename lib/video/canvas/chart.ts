import type { DrawContext } from './draw';
import type { ChartPlayback } from '../chart-model';
import { chartFrame } from '../chart-playback';
import { PANEL_COORDS, FOOT_COLORS, QUANT_COLORS, tickOf } from '../../vendor/step-analyzer/chart';
import { color, font } from '../../design/tokens';

/** Chart data is drawn as geometry. No foreign canvas, iframe, clock or network. */
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
  const laneX = 25 * u;
  const laneW = box.w * 0.43;
  const cell = laneW / 4;
  const top = 92 * u;
  const bottom = box.h - 38 * u;
  const receptor = top + 30 * u;
  const perBeat = Math.max(22 * u, (bottom - receptor) / 5 * clip.hispeed);
  const size = Math.min(cell * 0.7, 48 * u);
  ctx.save(); ctx.beginPath(); ctx.rect(laneX - 8 * u, top, laneW + 16 * u, bottom - top); ctx.clip();
  for (let p = 0; p < 4; p++) {
    const x = laneX + (p + 0.5) * cell;
    ctx.strokeStyle = color.lineStrong; ctx.lineWidth = u;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    arrow(x, receptor, size, p, color.muted, false);
  }
  for (let beat = Math.max(0, Math.floor(state.beat / 4) * 4); beat <= state.beat + (bottom - receptor) / perBeat; beat += 4) {
    const y = receptor + (beat - state.beat) * perBeat;
    ctx.strokeStyle = color.lineStrong; ctx.beginPath(); ctx.moveTo(laneX, y); ctx.lineTo(laneX + laneW, y); ctx.stroke();
  }
  for (const hold of clip.chart.holds) {
    const y1 = receptor + (Math.max(hold.startBeat, state.beat) - state.beat) * perBeat;
    const y2 = receptor + (hold.endBeat - state.beat) * perBeat;
    if (y2 < top || y1 > bottom) continue;
    ctx.fillStyle = color.muted;
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
      arrow(x, y, size, p, QUANT_COLORS[ev.row.quant] ?? color.fg, !ev.ghostPanels.includes(p));
      const foot = feet?.[p];
      if (foot) {
        ctx.fillStyle = FOOT_COLORS[foot]; ctx.fillRect(x + size / 5, y, size * 0.5, size * 0.5);
        ctx.fillStyle = color.deep; ctx.font = `900 ${size * 0.42}px ${font.mono}`; ctx.fillText(foot, x + size / 4, y);
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
  const pad = Math.min(box.w * 0.40, (bottom - top) * 0.82);
  const cx = box.w * 0.76; const cy = top + pad / 2;
  const unit = pad / 3;
  for (let p = 0; p < 5; p++) {
    const pt = PANEL_COORDS[p]; if (!pt) continue;
    const x = cx + pt.x * unit; const y = cy + pt.y * unit;
    const active = state.hit && (clip.chart.events[state.index]?.panels.includes(p) || (p === 4 && state.step?.shock && state.step.ghost));
    ctx.fillStyle = active ? color.accent : color.raised; ctx.fillRect(x - unit * 0.47, y - unit * 0.47, unit * 0.94, unit * 0.94);
    if (p < 4) arrow(x, y, unit * 0.6, p, active ? color.deep : color.muted, false);
  }
  for (const foot of ['L', 'R'] as const) {
    const pt = foot === 'L' ? state.left : state.right;
    const held = state.step?.heldFeet.includes(foot);
    ctx.save(); ctx.translate(cx + pt.x * unit + (foot === 'L' ? -1 : 1) * unit * 0.13, cy + pt.y * unit);
    ctx.rotate((state.step?.facing ?? 0) * Math.PI / 180);
    ctx.globalAlpha = state.step?.liftedFoot === foot ? 0.35 : 1;
    ctx.fillStyle = FOOT_COLORS[foot]; ctx.beginPath(); ctx.ellipse(0, 0, unit * 0.19, unit * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    if (held) { ctx.strokeStyle = color.fg; ctx.lineWidth = 3 * u; ctx.stroke(); }
    ctx.fillStyle = color.deep; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${unit * 0.35}px ${font.mono}`; ctx.fillText(foot, 0, 0); ctx.restore();
  }
  if (state.step?.stretch) {
    const stretch = state.step.stretch;
    const a = PANEL_COORDS[stretch.panels[0] ?? -1];
    const b = PANEL_COORDS[stretch.panels[1] ?? -1];
    if (a && b) {
      ctx.save(); ctx.strokeStyle = FOOT_COLORS[stretch.foot]; ctx.lineWidth = unit * 0.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx + a.x * unit, cy + a.y * unit); ctx.lineTo(cx + b.x * unit, cy + b.y * unit); ctx.stroke(); ctx.restore();
    }
  }
  ctx.fillStyle = color.fg; ctx.font = `600 ${labelSize * 0.85}px ${font.mono}`;
  ctx.fillText('L 左足   R 右足', box.w * 0.53, bottom - 45 * u);
  const comment = Object.entries(clip.comments).find(([tick]) => Math.floor(Number(tick) / 192) === Math.floor(state.beat / 4))?.[1];
  if (comment) { ctx.fillStyle = color.accent; ctx.fillText(comment, 14 * u, box.h - 30 * u, box.w - 28 * u); }
  ctx.restore();

  function arrow(x: number, y: number, s: number, p: number, ink: string, fill: boolean) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(([-Math.PI / 2, Math.PI, 0, Math.PI / 2][p] ?? 0));
    ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.lineTo(s / 2, 0); ctx.lineTo(s / 5, 0); ctx.lineTo(s / 5, s / 2); ctx.lineTo(-s / 5, s / 2); ctx.lineTo(-s / 5, 0); ctx.lineTo(-s / 2, 0); ctx.closePath();
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = Math.max(1, 2 * u); if (fill) ctx.fill(); else ctx.stroke(); ctx.restore();
  }
}
