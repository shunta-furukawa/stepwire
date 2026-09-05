import { blink, bob, wireFace, type Tone } from '@/lib/design/wire';
import type { Mood } from '@/lib/content/dialogue';
import { monoFace } from '@/lib/design/mono';

/**
 * WIRE and MONO on the page, as SVG.
 *
 * The geometry is `lib/design/wire.ts`, the same file the film paints from,
 * so the face beside a line of dialogue is the face on the video card. Tones
 * resolve to the CSS custom properties, so the face follows the theme.
 */

const TONES: Record<Tone, string> = {
  accent: 'var(--color-accent)',
  accentHot: 'var(--color-accent-hot)',
  fg: 'var(--color-fg)',
  muted: 'var(--color-muted)',
  raised: 'var(--color-raised)',
  line: 'var(--color-line)',
  lineStrong: 'var(--color-line-strong)',
  deep: 'var(--color-deep)',
};

const path = (points: [number, number][]) => points.map(([x, y]) => `${x},${y}`).join(' ');

export function WireFace({
  mood = 'neutral',
  /** Seconds into the face's own time: the film passes its frame, the page a fixed moment. */
  at = 1,
  className = '',
  title = 'WIRE',
}: {
  mood?: Mood;
  at?: number;
  className?: string;
  title?: string;
}) {
  const face = wireFace(mood);
  const float = bob(at);
  const open = blink(at);
  const outline = face.head[0]?.points ?? [];

  return (
    <svg viewBox="-4 -14 108 112" className={className} role="img" aria-label={title}>
      <g transform={`translate(${50 + float.dx} ${50 + float.dy}) rotate(${(float.tilt * 180) / Math.PI}) translate(-50 -50)`}>
        <line
          x1={face.antenna.from[0]}
          y1={face.antenna.from[1]}
          x2={face.antenna.to[0]}
          y2={face.antenna.to[1]}
          stroke={TONES.lineStrong}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={face.antenna.tip[0]} cy={face.antenna.tip[1]} r={3.2} fill={TONES.accent} />
        {face.head.map((facet, i) => (
          <polygon key={i} points={path(facet.points)} fill={TONES[facet.tone]} />
        ))}
        <polygon points={path(outline)} fill="none" stroke={TONES.accent} strokeWidth={2.5} strokeLinejoin="round" />
        {face.eyes.map((eye, i) => {
          if (eye.shape === 'arc') {
            return (
              <path
                key={i}
                d={`M ${eye.cx - eye.rx} ${eye.cy + 2} Q ${eye.cx} ${eye.cy - eye.ry * 1.1} ${eye.cx + eye.rx} ${eye.cy + 2}`}
                fill="none"
                stroke={TONES.accent}
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          }
          const ry = eye.shape === 'shut' ? 0 : eye.ry * open;
          if (ry < 1.2) {
            return (
              <line
                key={i}
                x1={eye.cx - eye.rx}
                y1={eye.cy}
                x2={eye.cx + eye.rx}
                y2={eye.cy}
                stroke={TONES.accent}
                strokeWidth={3.5}
                strokeLinecap="round"
              />
            );
          }
          return (
            <g key={i}>
              <ellipse cx={eye.cx} cy={eye.cy} rx={eye.rx} ry={ry} fill={TONES.accent} />
              <ellipse
                cx={eye.cx + eye.look[0] * eye.rx * (1 - eye.pupil)}
                cy={eye.cy + eye.look[1] * ry * (1 - eye.pupil)}
                rx={eye.rx * eye.pupil}
                ry={ry * eye.pupil}
                fill={TONES.deep}
              />
            </g>
          );
        })}
        {face.cheeks?.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={3.5} fill={TONES.accent} opacity={0.35} />
        ))}
        {face.brow ? (
          <line
            x1={face.brow[0][0]}
            y1={face.brow[0][1]}
            x2={face.brow[1][0]}
            y2={face.brow[1][1]}
            stroke={TONES.fg}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}
        {face.mouth.kind === 'round' ? (
          <ellipse
            cx={face.mouth.points[0]?.[0] ?? 50}
            cy={face.mouth.points[0]?.[1] ?? 75}
            rx={face.mouth.points[1]?.[0] ?? 4}
            ry={face.mouth.points[1]?.[1] ?? 5}
            fill={TONES.deep}
            stroke={TONES.fg}
            strokeWidth={3}
          />
        ) : (
          <path
            d={`M ${face.mouth.points[0]?.join(' ')} C ${face.mouth.points[1]?.join(' ')} ${face.mouth.points[2]?.join(' ')} ${face.mouth.points[3]?.join(' ')}`}
            fill="none"
            stroke={TONES.fg}
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
      </g>
    </svg>
  );
}

/** MONO: the shared silhouette on the deepest ground, the low-poly M, a mouth. */
export function MonoMark({ className = '' }: { className?: string }) {
  const face = monoFace();
  return (
    <svg viewBox="-4 -14 108 112" className={className} role="img" aria-label="MONO">
      <polygon points={path(face.head)} fill={TONES.deep} stroke={TONES.fg} strokeWidth={2.5} strokeLinejoin="round" />
      {face.facets.map((facet, i) => (
        <polygon
          key={i}
          points={path(facet.points)}
          fill={facet.lime ? TONES.accent : TONES.fg}
          fillOpacity={facet.alpha}
        />
      ))}
      <path
        d={`M ${face.mouth.points[0]?.join(' ')} C ${face.mouth.points[1]?.join(' ')} ${face.mouth.points[2]?.join(' ')} ${face.mouth.points[3]?.join(' ')}`}
        fill="none"
        stroke={TONES.fg}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}
