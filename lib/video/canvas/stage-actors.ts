import type { DrawContext } from './draw';
import type { Scene } from '../scenes';
import { characterPose, POSE_IMAGES, type CharacterPose } from '../character-poses';
import { drawWireExpression } from './stage-motion';

/** Each generated plate has its own source split and head registration. */
const REGISTRATION: Record<CharacterPose, {
  split: number;
  WIRE: { scale: number; x: number; y: number };
  MONO: { scale: number; x: number; y: number };
}> = {
  default: { split: 836, WIRE: { scale: 0.81, x: 100, y: 62 }, MONO: { scale: 0.83, x: 202, y: 50 } },
  explain: { split: 836, WIRE: { scale: 0.76, x: 62, y: 92 }, MONO: { scale: 0.80, x: 246, y: 74 } },
  think: { split: 800, WIRE: { scale: 0.69, x: 96, y: 160 }, MONO: { scale: 0.72, x: 376, y: 130 } },
  celebrate: { split: 760, WIRE: { scale: 0.70, x: 58, y: 125 }, MONO: { scale: 0.71, x: 410, y: 125 } },
};

/** Swap arm/hand illustrations on turns; keep face animation and photo layering. */
export function drawConversationActors(d: DrawContext, scene: Scene, fallback: CanvasImageSource, artY: number, artH: number) {
  const { ctx } = d;
  ctx.save();
  ctx.translate(0, artY);
  ctx.scale(d.width / 1672, artH / 941);
  for (const who of ['WIRE', 'MONO'] as const) {
    const wire = who === 'WIRE';
    const wanted = characterPose(scene, who);
    const loaded = d.images.get(POSE_IMAGES[wanted]);
    // The fallback uses its own registration, never that of the missing pose.
    const pose = loaded ? wanted : 'default';
    const sprites = loaded ?? fallback;
    const registration = REGISTRATION[pose];
    const { scale, x, y } = registration[who];
    const sourceX = wire ? 0 : registration.split;
    const sourceW = wire ? registration.split : 1672 - registration.split;
    ctx.save();
    const mediaOffset = scene.image && d.width > d.height ? (wire ? -28 : 28) : 0;
    ctx.translate(mediaOffset, 0);
    ctx.drawImage(sprites, sourceX, 0, sourceW, 941,
      x + sourceX * scale, y, sourceW * scale, 941 * scale);
    if (wire) drawWireExpression({ ...d, width: 1672 }, scene, 0, 941);
    ctx.restore();
  }
  ctx.restore();
}
