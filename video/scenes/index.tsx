import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Scene } from '../../lib/video/scenes';
import { color, font, fontWeight, gap, leading, textStyles, tracking, type } from '../styles/theme';
import {
  Arrow,
  BodyText,
  Card,
  KineticText,
  LabelChip,
  PanelGrid,
  ProgressRail,
  ScanLines,
  WireBar,
  easeOut,
  useEnter,
} from '../components/primitives';

/**
 * Reusable scenes.
 *
 * Every scene takes the same props: one `Scene` from the derived sequence plus
 * the layout it is rendering into. That uniformity is what lets
 * `buildSceneSequence` decide the whole film without any scene knowing about
 * any other.
 */

export interface SceneProps {
  scene: Scene;
  orientation: 'vertical' | 'landscape';
}

/**
 * Only the first card of a section carries a label, so continuation cards need
 * their own wire-bar caption — otherwise the bar renders empty.
 */
const SECTION_CAPTION: Record<string, string> = {
  news: 'WHAT HAPPENED',
  context: 'WHY IT MATTERS',
  impact: 'PLAYER IMPACT',
  data: 'BY THE NUMBERS',
  source: 'SOURCE',
  headline: 'HEADLINE',
};

function caption(scene: Scene): string {
  return scene.label ?? SECTION_CAPTION[scene.type] ?? 'STEPWIRE';
}

/** Layout constants that differ between the two formats. */
function layout(orientation: SceneProps['orientation']) {
  return orientation === 'vertical'
    ? {
        padding: gap.xl,
        headline: type.h2,
        wordmark: type.h1,
        body: type.h4,
        maxWidth: '100%' as const,
      }
    : {
        // Landscape has less vertical room per line than its width suggests:
        // at 1080px tall, a full body card has to fit inside roughly 840px
        // once the wire bar, the label chip and the progress rail are placed.
        // Smaller body type and a wider measure keep a dense card inside frame.
        padding: gap.xl,
        headline: type.h1,
        wordmark: type.display,
        body: type.h4,
        maxWidth: '82%' as const,
      };
}

// ---------------------------------------------------------------------------

export function IntroScene({ scene, orientation }: SceneProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const l = layout(orientation);

  // The wordmark assembles: STEP arrives from the left, WIRE from the right,
  // and they meet on a rule. The "wire transmission" idea as a single gesture.
  const assemble = easeOut(frame / 16);
  const ruleWidth = interpolate(easeOut((frame - 8) / 14), [0, 1], [0, 100], {
    extrapolateRight: 'clamp',
  });
  const exit = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: color.ink, opacity: exit }}>
      <PanelGrid opacity={0.14} stroke={color.paper} />
      <ScanLines opacity={0.08} />
      <Card background="transparent" padding={l.padding} inverted>
        <div />
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              ...textStyles.display,
              display: 'block',
              fontSize: l.wordmark,
              color: color.paper,
              transform: `translateX(${(1 - assemble) * -14}%)`,
              opacity: assemble,
            }}
          >
            STEP
          </span>
          <span
            style={{
              display: 'block',
              height: 8,
              width: `${ruleWidth}%`,
              margin: `${gap.sm}px auto`,
              background: color.signalOnDark,
            }}
          />
          <span
            style={{
              ...textStyles.display,
              display: 'block',
              fontSize: l.wordmark,
              color: color.paper,
              transform: `translateX(${(1 - assemble) * 14}%)`,
              opacity: assemble,
            }}
          >
            WIRE
          </span>
          {scene.text ? (
            <p
              style={{
                ...textStyles.meta,
                marginTop: gap.lg,
                color: color.gray300,
                fontSize: type.base,
                opacity: easeOut((frame - 14) / 10),
              }}
            >
              {scene.text}
            </p>
          ) : null}
        </div>
        <p style={{ ...textStyles.meta, color: color.gray500, textAlign: 'center' }}>
          {scene.meta}
        </p>
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

export function HeadlineScene({ scene, orientation }: SceneProps) {
  const l = layout(orientation);
  const enter = useEnter(10, 4);

  return (
    <AbsoluteFill style={{ background: color.offWhite }}>
      <ScanLines opacity={0.04} />
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={caption(scene)} />

        <div>
          <Arrow direction="up" size={type.h2} />
          <div style={{ marginTop: gap.md }}>
            <KineticText
              text={scene.text ?? ''}
              fontSize={l.headline}
              stagger={2}
              delay={2}
              // The display style is tuned for the Latin wordmark; a headline
              // that may be Japanese needs its tracking relaxed.
              style={{
                maxWidth: l.maxWidth,
                letterSpacing: `${tracking.headline}em`,
                lineHeight: leading.headline,
              }}
            />
          </div>
          {scene.meta ? (
            <p
              style={{
                ...textStyles.body,
                fontSize: type.lead,
                color: color.gray700,
                marginTop: gap.lg,
                maxWidth: l.maxWidth,
                ...enter,
              }}
            >
              {scene.meta}
            </p>
          ) : null}
        </div>

        <ProgressRail index={scene.index} total={scene.total} />
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

/**
 * The three body scenes share a layout and differ only in accent treatment:
 * NEWS is reported fact (light ground), CONTEXT and PLAYER IMPACT are analysis
 * (inverted ground). The inversion is the same fact/analysis distinction the
 * website draws with its section labels.
 */
function BodyScene({
  scene,
  orientation,
  inverted,
  accent,
}: SceneProps & { inverted: boolean; accent: string }) {
  const l = layout(orientation);

  return (
    <AbsoluteFill style={{ background: inverted ? color.ink : color.offWhite }}>
      <PanelGrid opacity={inverted ? 0.1 : 0.06} stroke={inverted ? color.paper : color.ink} />
      <ScanLines opacity={inverted ? 0.06 : 0.035} />
      <Card background="transparent" padding={l.padding} inverted={inverted}>
        <WireBar meta={caption(scene)} inverted={inverted} />

        <div>
          {scene.label ? (
            <div style={{ marginBottom: gap.lg }}>
              <LabelChip inverted={inverted}>{scene.label}</LabelChip>
            </div>
          ) : (
            <div
              style={{
                width: 96,
                height: 8,
                background: accent,
                marginBottom: gap.lg,
              }}
            />
          )}
          <BodyText
            text={scene.text ?? ''}
            fontSize={l.body}
            color={inverted ? color.paper : color.ink}
            maxWidth={l.maxWidth}
          />
        </div>

        <ProgressRail index={scene.index} total={scene.total} inverted={inverted} />
      </Card>
    </AbsoluteFill>
  );
}

export function NewsScene(props: SceneProps) {
  return <BodyScene {...props} inverted={false} accent={color.ink} />;
}

export function ContextScene(props: SceneProps) {
  return <BodyScene {...props} inverted accent={color.signalOnDark} />;
}

export function ImpactScene(props: SceneProps) {
  return <BodyScene {...props} inverted accent={color.wire} />;
}

// ---------------------------------------------------------------------------

/**
 * The data readout. The one place the `wire` accent is allowed, because this is
 * the DDR-derived numeric information the brand treats as its own content class.
 */
export function DataScene({ scene, orientation }: SceneProps) {
  const frame = useCurrentFrame();
  const l = layout(orientation);
  const values = scene.data ?? [];

  return (
    <AbsoluteFill style={{ background: color.paper }}>
      <PanelGrid opacity={0.1} />
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={caption(scene)} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: values.length > 2 ? '1fr 1fr' : '1fr',
            gap: gap.lg,
          }}
        >
          {values.map((entry, index) => {
            const progress = easeOut((frame - index * 4) / 12);
            // Values are usually short numerals, but a word-shaped value needs
            // to step down or it wraps across the whole card.
            const valueSize =
              entry.value.length > 4
                ? type.h3
                : orientation === 'vertical'
                  ? type.h1
                  : type.display;
            return (
              <div
                key={entry.label}
                style={{
                  borderTop: `8px solid ${color.ink}`,
                  paddingTop: gap.md,
                  opacity: progress,
                  transform: `translateY(${(1 - progress) * 16}px)`,
                }}
              >
                <p style={{ ...textStyles.meta, color: color.gray700, margin: 0 }}>
                  {entry.label}
                </p>
                <p
                  style={{
                    ...textStyles.display,
                    fontSize: valueSize,
                    color: color.wire,
                    margin: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {entry.value}
                </p>
              </div>
            );
          })}
        </div>

        <ProgressRail index={scene.index} total={scene.total} />
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

/**
 * The source card.
 *
 * Non-negotiable in the sequence: a STEPWIRE video always says where the story
 * came from, in the same way the article always lists its sources.
 */
export function SourceScene({ scene, orientation }: SceneProps) {
  const l = layout(orientation);
  const enter = useEnter(10);

  return (
    <AbsoluteFill style={{ background: color.offWhite }}>
      <ScanLines opacity={0.04} />
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={caption(scene)} />

        <div style={enter}>
          <div style={{ height: 8, width: '100%', background: color.ink, marginBottom: gap.lg }} />
          <p style={{ ...textStyles.meta, color: color.gray700, margin: 0 }}>{scene.label}</p>
          <p
            style={{
              ...textStyles.body,
              fontSize: type.h4,
              margin: `${gap.sm}px 0 0`,
              maxWidth: l.maxWidth,
            }}
          >
            {scene.text}
          </p>
          <p style={{ ...textStyles.meta, color: color.gray700, marginTop: gap.md }}>
            {scene.meta}
          </p>
        </div>

        <ProgressRail index={scene.index} total={scene.total} />
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

export function OutroScene({ scene, orientation }: SceneProps) {
  const frame = useCurrentFrame();
  const l = layout(orientation);
  const enter = easeOut(frame / 12);

  return (
    <AbsoluteFill style={{ background: color.ink }}>
      <PanelGrid opacity={0.14} stroke={color.paper} />
      <ScanLines opacity={0.08} />
      <Card background="transparent" padding={l.padding} inverted>
        <div />
        <div style={{ textAlign: 'center', opacity: enter }}>
          <span
            style={{
              ...textStyles.display,
              display: 'block',
              fontSize: l.wordmark,
              color: color.paper,
            }}
          >
            STEP<span style={{ color: color.signalOnDark }}>WIRE</span>
          </span>
          <p
            style={{
              fontFamily: font.mono,
              fontSize: type.base,
              fontWeight: fontWeight.regular,
              letterSpacing: `${tracking.wider}em`,
              textTransform: 'uppercase',
              color: color.gray300,
              marginTop: gap.md,
            }}
          >
            {scene.meta}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: gap.md }}>
          {(['left', 'down', 'up', 'right'] as const).map((direction, index) => (
            <Arrow
              key={direction}
              direction={direction}
              size={type.h3}
              fill={index % 2 === 0 ? color.paper : color.signalOnDark}
              style={{ opacity: easeOut((frame - 6 - index * 3) / 10) }}
            />
          ))}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

/** Scene type → component. Adding a scene type means adding one entry here. */
export const SCENE_COMPONENTS: Record<Scene['type'], React.FC<SceneProps>> = {
  intro: IntroScene,
  headline: HeadlineScene,
  news: NewsScene,
  context: ContextScene,
  impact: ImpactScene,
  data: DataScene,
  source: SourceScene,
  outro: OutroScene,
};
