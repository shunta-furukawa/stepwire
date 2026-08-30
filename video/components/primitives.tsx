import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { color, font, fontWeight, gap, px, textStyles, tracking, type } from '../styles/theme';

/**
 * STEPWIRE motion primitives.
 *
 * The visual language is abstracted from the machine rather than copied from
 * it: arrows become directional marks, the four-panel layout becomes a grid,
 * the step timeline becomes a progress rail, and the idea of a wire
 * transmission becomes scanlines and a ticker. None of it reproduces game
 * artwork; all of it is recognisably about this subject.
 */

/** Frame-based easing that matches the website's `--ease-brand`. */
export function easeOut(progress: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3);
}

/** Standard card entrance: a short rise plus fade, over `duration` frames. */
export function useEnter(duration = 10, delay = 0) {
  const frame = useCurrentFrame();
  const progress = easeOut((frame - delay) / duration);
  return {
    opacity: interpolate(progress, [0, 1], [0, 1], { extrapolateRight: 'clamp' }),
    transform: `translateY(${interpolate(progress, [0, 1], [18, 0], {
      extrapolateRight: 'clamp',
    })}px)`,
  };
}

/**
 * Scanline overlay — the transmission motif. Held at very low opacity: it is
 * texture, not decoration, and must never fight the type for contrast.
 */
export function ScanLines({ opacity = 0.05 }: { opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        backgroundImage: `repeating-linear-gradient(to bottom, ${color.ink} 0px, ${color.ink} 2px, transparent 2px, transparent 8px)`,
      }}
    />
  );
}

/**
 * The four-panel grid. An abstraction of the panel layout, used as a structural
 * background rather than as an illustration of it.
 */
export function PanelGrid({
  opacity = 0.08,
  stroke = color.ink,
}: {
  opacity?: number;
  stroke?: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        backgroundImage: `linear-gradient(to right, ${stroke} 2px, transparent 2px), linear-gradient(to bottom, ${stroke} 2px, transparent 2px)`,
        backgroundSize: '25% 25%',
      }}
    />
  );
}

/** A directional mark. Four rotations of one shape — the arrow abstraction. */
export function Arrow({
  direction = 'up',
  size = 24,
  fill = color.signal,  // callers on a dark ground pass color.signalOnDark
  style,
}: {
  direction?: 'up' | 'right' | 'down' | 'left';
  size?: number;
  fill?: string;
  style?: React.CSSProperties;
}) {
  const rotation = { up: 0, right: 90, down: 180, left: 270 }[direction];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${rotation}deg)`, ...style }}
      aria-hidden="true"
    >
      <path d="M12 2 L22 14 L15 14 L15 22 L9 22 L9 14 L2 14 Z" fill={fill} />
    </svg>
  );
}

/** The section label chip. */
export function LabelChip({
  children,
  inverted = false,
}: {
  children: React.ReactNode;
  inverted?: boolean;
}) {
  return (
    <span
      style={{
        ...textStyles.label,
        display: 'inline-flex',
        alignItems: 'center',
        gap: gap.sm,
        padding: `${gap.sm}px ${gap.md}px`,
        background: inverted ? color.paper : color.ink,
        color: inverted ? color.ink : color.paper,
      }}
    >
      <Arrow
        direction="right"
        size={type.base}
        fill={inverted ? color.signal : color.signalOnDark}
      />
      {children}
    </span>
  );
}

/**
 * The progress rail — a step timeline across the bottom of every card.
 *
 * It tells a viewer how much is left, which measurably reduces drop-off on
 * short-form video, and it is the "step / timeline" motif doing real work
 * rather than sitting there as ornament.
 */
export function ProgressRail({
  index,
  total,
  inverted = false,
}: {
  index: number;
  total: number;
  inverted?: boolean;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const within = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ display: 'flex', gap: gap.xs, width: '100%' }}>
      {Array.from({ length: total }).map((_, position) => {
        const state = position < index ? 1 : position === index ? within : 0;
        return (
          <div
            key={position}
            style={{
              flex: 1,
              height: 6,
              background: inverted ? 'rgba(255,255,255,0.25)' : color.gray300,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${state * 100}%`,
                height: '100%',
                background:
                  position === index
                    ? inverted
                      ? color.signalOnDark
                      : color.signal
                    : inverted
                      ? color.paper
                      : color.ink,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** The persistent masthead strip. Keeps the brand present without a watermark. */
export function WireBar({
  meta,
  inverted = false,
}: {
  meta?: string;
  inverted?: boolean;
}) {
  const frame = useCurrentFrame();
  const blink = Math.sin(frame / 6) > -0.4 ? 1 : 0.25;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: gap.md,
        width: '100%',
      }}
    >
      <span
        style={{
          fontFamily: font.display,
          fontWeight: fontWeight.black,
          fontSize: type.h4,
          letterSpacing: `${tracking.display}em`,
          color: inverted ? color.paper : color.ink,
        }}
      >
        STEP<span style={{ color: inverted ? color.signalOnDark : color.signal }}>WIRE</span>
      </span>

      <span
        style={{
          ...textStyles.meta,
          display: 'flex',
          alignItems: 'center',
          gap: gap.sm,
          color: inverted ? color.gray300 : color.gray700,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            background: inverted ? color.signalOnDark : color.signal,
            opacity: blink,
            display: 'block',
          }}
        />
        {meta ?? 'LIVE'}
      </span>
    </div>
  );
}

/**
 * Kinetic type: words arrive one after another.
 *
 * Word-level rather than character-level on purpose — character reveals look
 * busy and slow a viewer down, word reveals read as emphasis.
 */
export function KineticText({
  text,
  fontSize: size,
  color: textColor = color.ink,
  stagger = 2,
  delay = 0,
  style,
}: {
  text: string;
  fontSize: number;
  color?: string;
  stagger?: number;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <span
      style={{
        ...textStyles.display,
        fontSize: size,
        color: textColor,
        display: 'block',
        textWrap: 'balance',
        ...style,
      }}
    >
      {words.map((word, index) => {
        const progress = easeOut((frame - delay - index * stagger) / 9);
        return (
          <span
            key={`${word}-${index}`}
            style={{
              display: 'inline-block',
              marginRight: '0.26em',
              opacity: progress,
              transform: `translateY(${(1 - progress) * 0.16}em)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}

/** A body-copy block with a reveal that matches `KineticText`'s feel. */
export function BodyText({
  text,
  fontSize: size,
  color: textColor = color.ink,
  maxWidth,
}: {
  text: string;
  fontSize: number;
  color?: string;
  maxWidth?: number | string;
}) {
  const enter = useEnter(12);
  return (
    <p
      style={{
        ...textStyles.body,
        fontSize: size,
        color: textColor,
        margin: 0,
        maxWidth,
        textWrap: 'pretty',
        ...enter,
      }}
    >
      {text}
    </p>
  );
}

/** A full-bleed card. `frame` draws the heavy editorial border. */
export function Card({
  children,
  background = color.offWhite,
  padding,
  inverted = false,
}: {
  children: React.ReactNode;
  background?: string;
  padding: number;
  inverted?: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background,
        padding,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        color: inverted ? color.paper : color.ink,
      }}
    >
      {children}
    </div>
  );
}

export { px };
