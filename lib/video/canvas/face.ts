import { blink, bob, wireFace, type Tone } from '../../design/wire';
import { monoFace } from '../../design/mono';
import type { Mood } from '../../content/dialogue';
import { color } from '../../design/tokens';

/**
 * WIRE and MONO on the canvas.
 *
 * The geometry is `lib/design/wire.ts`; this only paints it. The website
 * paints the same geometry as SVG (`components/Faces.tsx`), so the face on a
 * card is the face on the page. Time is passed in as seconds so the blink and
 * the float are the same on every run of the same frame.
 */

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const TONES: Record<Tone, string> = {
  accent: color.accent,
  accentHot: color.accentHot,
  fg: color.fg,
  muted: color.muted,
  raised: color.raised,
  line: color.line,
  lineStrong: color.lineStrong,
  deep: color.deep,
};

function polygon(ctx: Ctx, points: [number, number][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Draws WIRE in the `size`-wide box at (x, y), at `t` seconds. */
export function drawWire(ctx: Ctx, x: number, y: number, size: number, mood: Mood, t: number) {
  const face = wireFace(mood);
  const float = bob(t);
  const open = blink(t);
  const scale = size / 100;

  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(scale, scale);
  ctx.rotate(float.tilt);
  ctx.translate(-50 + float.dx, -50 + float.dy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // The antenna sits behind the head.
  ctx.strokeStyle = TONES.lineStrong;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(...face.antenna.from);
  ctx.lineTo(...face.antenna.to);
  ctx.stroke();
  ctx.fillStyle = TONES.accent;
  ctx.beginPath();
  ctx.arc(face.antenna.tip[0], face.antenna.tip[1], 3.2, 0, Math.PI * 2);
  ctx.fill();

  for (const facet of face.head) {
    polygon(ctx, facet.points);
    ctx.fillStyle = TONES[facet.tone];
    ctx.fill();
  }
  polygon(ctx, face.head[0]?.points ?? []);
  ctx.strokeStyle = TONES.accent;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (const eye of face.eyes) {
    ctx.fillStyle = TONES.accent;
    ctx.strokeStyle = TONES.accent;
    if (eye.shape === 'arc') {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(eye.cx - eye.rx, eye.cy + 2);
      ctx.quadraticCurveTo(eye.cx, eye.cy - eye.ry * 1.1, eye.cx + eye.rx, eye.cy + 2);
      ctx.stroke();
      continue;
    }
    // A shut eye and a blink are the same line; `open` squashes the lids.
    const ry = eye.shape === 'shut' ? 0 : eye.ry * Math.max(0, open);
    if (ry < 1.2) {
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(eye.cx - eye.rx, eye.cy);
      ctx.lineTo(eye.cx + eye.rx, eye.cy);
      ctx.stroke();
      continue;
    }
    ctx.beginPath();
    ctx.ellipse(eye.cx, eye.cy, eye.rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // The highlight is what makes an eye look somewhere.
    ctx.fillStyle = TONES.deep;
    ctx.beginPath();
    ctx.ellipse(
      eye.cx + eye.look[0] * eye.rx * (1 - eye.pupil),
      eye.cy + eye.look[1] * ry * (1 - eye.pupil),
      eye.rx * eye.pupil,
      ry * eye.pupil,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  if (face.cheeks) {
    ctx.fillStyle = TONES.accent;
    ctx.globalAlpha = 0.35;
    for (const [cx, cy] of face.cheeks) {
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (face.brow) {
    ctx.strokeStyle = TONES.fg;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(...face.brow[0]);
    ctx.lineTo(...face.brow[1]);
    ctx.stroke();
  }

  ctx.strokeStyle = TONES.fg;
  ctx.lineWidth = 3;
  if (face.mouth.kind === 'round') {
    const [[cx, cy], [rx, ry]] = [face.mouth.points[0] ?? [50, 75], face.mouth.points[1] ?? [4, 5]];
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = TONES.deep;
    ctx.fill();
    ctx.stroke();
  } else {
    const [a, b, c, e] = face.mouth.points;
    if (a && b && c && e) {
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.bezierCurveTo(b[0], b[1], c[0], c[1], e[0], e[1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * MONO: the shared silhouette on the deepest ground, MONO DDR's low-poly M
 * where the eyes would be, and a mouth. Still — it is the operator's mark,
 * and the operator's face is the operator's own.
 */
export function drawMono(ctx: Ctx, x: number, y: number, size: number) {
  const face = monoFace();
  const scale = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  polygon(ctx, face.head);
  ctx.fillStyle = TONES.deep;
  ctx.fill();
  ctx.strokeStyle = TONES.fg;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (const facet of face.facets) {
    polygon(ctx, facet.points);
    ctx.globalAlpha = facet.alpha;
    ctx.fillStyle = facet.lime ? TONES.accent : TONES.fg;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const [a, b, c, e] = face.mouth.points;
  if (a && b && c && e) {
    ctx.strokeStyle = TONES.fg;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(...a);
    ctx.bezierCurveTo(b[0], b[1], c[0], c[1], e[0], e[1]);
    ctx.stroke();
  }
  ctx.restore();
}
