import type { Speaker } from '../../content/dialogue';
import type { DrawContext } from './draw';
import type { Scene } from '../scenes';
import { visibleUnits } from '../reveal';
import { drawWireExpression } from './stage-motion';

/** Independent, bounded upper-body performances, with the waist as pivot. */
export function actorPose(d: Pick<DrawContext, 'frame' | 'fps'>, scene: Scene, who: Speaker) {
  const fps = d.fps ?? 30;
  const t = Math.max(0, d.frame) / fps;
  const isWire = who === 'WIRE';
  const phase = isWire ? 0 : 1.7;
  const active = scene.speaker === who;
  const revealing = !!scene.reveal && visibleUnits(scene.reveal, d.frame) < scene.reveal.units;
  // Enter and exit envelopes keep adjacent turns from snapping to new poses.
  const remaining = Math.max(0, (scene.durationInFrames - 1 - d.frame) / fps);
  const envelope = Math.min(1, t / 0.3, remaining / 0.3);
  const breath = Math.sin(t * 1.65 + phase) - Math.sin(phase);
  const beat = Math.sin(t * (isWire ? 5.0 : 3.5));
  // Listeners give an occasional small nod instead of mirroring the speaker.
  const nodPhase = (t + phase) % 3.8;
  const nod = nodPhase > 1.6 && nodPhase < 2.3
    ? Math.sin((nodPhase - 1.6) / 0.7 * Math.PI) : 0;
  const emphasis = active && revealing ? (isWire ? 1 : 0.7) : 0;
  const moodBoost = active && isWire && (scene.mood === 'surprise' || scene.mood === 'grin') ? 1.35 : 1;
  return {
    x: envelope * ((isWire ? 1 : -1) * (active ? 5 : 0) + Math.sin(t * 1.15 + phase) * 2),
    y: envelope * (-2.5 * breath - Math.abs(beat) * emphasis * 5 + (!active ? nod * 4 : 0)),
    rotation: envelope * ((isWire ? 1 : -1) * (active ? 0.008 : 0) + beat * emphasis * 0.011 * moodBoost + (!active ? nod * 0.008 : 0)),
    scaleY: 1 + envelope * (breath * 0.003 + Math.abs(beat) * emphasis * 0.004),
  };
}

/** True alpha sprites: scenery stays still and expressions follow WIRE's body. */
export function drawConversationActors(d: DrawContext, scene: Scene, sprites: CanvasImageSource, artY: number, artH: number) {
  const { ctx } = d;
  ctx.save();
  ctx.translate(0, artY);
  ctx.scale(d.width / 1672, artH / 941);
  for (const who of ['WIRE', 'MONO'] as const) {
    const wire = who === 'WIRE';
    const pivotX = wire ? 370 : 1280;
    const pose = actorPose(d, scene, who);
    ctx.save();
    // Leave more of the enlarged photograph visible between the two actors.
    const mediaOffset = scene.image && d.width > d.height ? (wire ? -28 : 28) : 0;
    ctx.translate(pivotX + pose.x + mediaOffset, 758 + pose.y);
    ctx.rotate(pose.rotation);
    ctx.scale(1, pose.scaleY);
    ctx.translate(-pivotX, -758);
    // Register the generated cutouts back onto the original stage coordinates.
    const sourceX = wire ? 0 : 836;
    const scale = wire ? 0.81 : 0.83;
    const x = (wire ? 100 : 202) + sourceX * scale;
    const y = wire ? 62 : 50;
    ctx.drawImage(sprites, sourceX, 0, 836, 941, x, y, 836 * scale, 941 * scale);
    if (wire) drawWireExpression({ ...d, width: 1672 }, scene, 0, 941);
    ctx.restore();
  }
  ctx.restore();
}
