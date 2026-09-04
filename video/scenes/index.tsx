import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { SCENE_TONE, type Scene } from '../../lib/video/scenes';
import { revealedText, visibleUnits } from '../../lib/video/reveal';
import { barFractions, difficultyLabel, formatBarValue, formatScore } from '../../lib/content/figures';
import { fitBodySize, visualLength } from '../../lib/video/text';
import { color,
  difficulty, font, fontWeight, gap, leading, textStyles, tracking, type } from '../styles/theme';
import {
  Arrow,
  Card,
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
  figure: 'BY THE NUMBERS',
  source: 'SOURCE',
  headline: 'HEADLINE',
  narration: 'STEPWIRE',
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

// ---------------------------------------------------------------------------

/**
 * Typed copy — the game text box.
 *
 * Which characters are on screen at this frame comes from the scene's reveal
 * plan, never from an easing curve chosen here: the canvas renderer and the
 * tick track read the same plan, so a character lands on the same frame its
 * tick sounds, on every surface.
 */
function Typed({
  scene,
  style,
  color: fill = color.fg,
}: {
  scene: Scene;
  style: React.CSSProperties;
  color?: string;
}) {
  const frame = useCurrentFrame();
  const text = scene.text ?? '';
  const shown = scene.reveal ? revealedText(text, visibleUnits(scene.reveal, frame)) : text;
  const done = !scene.reveal || visibleUnits(scene.reveal, frame) >= scene.reveal.units;

  return (
    <p style={{ ...style, color: fill, margin: 0, whiteSpace: 'pre-wrap' }}>
      {shown}
      {/* A cursor while typing, gone when the line is complete. */}
      {!done ? (
        <span style={{ color: color.accent, opacity: Math.floor(frame / 4) % 2 ? 1 : 0.2 }}>▍</span>
      ) : null}
    </p>
  );
}

/**
 * Every scene is transparent. The ground, the picture and the particle field
 * are painted once, under the whole film, by the composition root — the same
 * stack the canvas renderer paints, from the same `lib/video/ground.ts`.
 */
const TRANSPARENT = { background: 'transparent' } as const;

export function HeadlineScene({ scene, orientation }: SceneProps) {
  const l = layout(orientation);
  const enter = useEnter(10, 4);

  return (
    <AbsoluteFill style={TRANSPARENT}>
      {scene.image ? null : <ScanLines opacity={0.04} />}
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={scene.kicker} />

        <div>
          <Arrow direction="up" size={type.h2} />
          <div style={{ marginTop: gap.md }}>
            <Typed
              scene={scene}
              style={{
                ...textStyles.display,
                fontSize: l.headline,
                maxWidth: l.maxWidth,
                // The display style is tuned for the Latin wordmark; a headline
                // that may be Japanese needs its tracking relaxed.
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
                color: color.muted,
                marginTop: gap.lg,
                maxWidth: l.maxWidth,
                ...enter,
              }}
            >
              {scene.meta}
            </p>
          ) : null}
        </div>

        <div>
          {scene.image?.credit ? (
            <p style={{ ...textStyles.meta, color: color.faint, margin: `0 0 ${gap.md}px` }}>
              {scene.image.credit}
            </p>
          ) : null}
          <ProgressRail index={scene.index} total={scene.total} />
        </div>
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

/**
 * The three body scenes share a layout and differ only in accent treatment:
 * NEWS is reported fact (light ground), CONTEXT and PLAYER IMPACT are analysis
 * (a raised ground). The elevation is the same fact/analysis distinction the
 * website draws with its section labels.
 */
/**
 * The picture a body card carries — beside the copy in landscape, above it in
 * portrait. Shown whole and lit, with its credit, because a result photo is
 * what the card is about; the words keep their own ground.
 */
function Panel({ image, orientation }: { image: NonNullable<Scene['image']>; orientation: SceneProps['orientation'] }) {
  const frame = useCurrentFrame();
  const landscape = orientation !== 'vertical';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: gap.sm, ...(landscape ? { width: '40%', alignSelf: 'stretch' } : { height: '46%' }) }}>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', border: `2px solid ${color.lineStrong}` }}>
        <Img
          src={staticFile(image.src.replace(/^\//, ''))}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${1 + Math.min(0.06, frame / 3000)})`,
          }}
        />
      </div>
      <p style={{ ...textStyles.meta, fontSize: type.micro, color: color.faint, margin: 0 }}>{image.credit}</p>
    </div>
  );
}

function BodyScene({
  scene,
  orientation,
  accent,
  tone,
}: SceneProps & { accent: string; tone: 'fact' | 'analysis' }) {
  const l = layout(orientation);
  const landscape = orientation !== 'vertical';
  const { width, height } = useVideoConfig();

  // The same fit the canvas renderer measures for, estimated: the room above
  // the rail, minus the chip, in a column the picture may have narrowed.
  const contentWidth = width - l.padding * 2;
  const measure = scene.image && landscape ? contentWidth * 0.56 : contentWidth * (landscape ? 0.82 : 1);
  const band = height - 440;
  const room = (scene.image && !landscape ? band * 0.5 : band) - (scene.label ? 156 : 68);
  const bodySize = scene.text
    ? fitBodySize(scene.text, { size: l.body, measure, height: room, lineHeight: leading.tight })
    : l.body;

  return (
    <AbsoluteFill style={TRANSPARENT}>
      <PanelGrid opacity={0.09} />
      <ScanLines opacity={0.05} />
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={caption(scene)} />

        <div
          style={
            scene.image
              ? { display: 'flex', flexDirection: landscape ? 'row' : 'column', gap: gap.xl, alignItems: landscape ? 'center' : 'stretch', flex: 1, minHeight: 0 }
              : undefined
          }
        >
          {scene.image && !landscape ? <Panel image={scene.image} orientation={orientation} /> : null}
        <div style={scene.image ? { flex: 1, minWidth: 0 } : undefined}>
          {scene.label ? (
            <div style={{ marginBottom: gap.lg }}>
              <LabelChip tone={tone}>{scene.label}</LabelChip>
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
          <Typed
            scene={scene}
            style={{
              ...textStyles.body,
              fontSize: bodySize,
              maxWidth: scene.image ? '100%' : l.maxWidth,
              lineHeight: leading.tight,
            }}
          />
        </div>
          {scene.image && landscape ? <Panel image={scene.image} orientation={orientation} /> : null}
        </div>

        <ProgressRail index={scene.index} total={scene.total} />
      </Card>
    </AbsoluteFill>
  );
}

export function NewsScene(props: SceneProps) {
  // Reported fact sits on the deepest, plainest ground with a neutral rule:
  // nothing about how it is drawn editorialises it.
  return <BodyScene {...props} accent={color.fg} tone={SCENE_TONE.news} />;
}

export function ContextScene(props: SceneProps) {
  return <BodyScene {...props} accent={color.accent} tone={SCENE_TONE.context} />;
}

export function ImpactScene(props: SceneProps) {
  return <BodyScene {...props} accent={color.accent} tone={SCENE_TONE.impact} />;
}

// ---------------------------------------------------------------------------

/**
 * The figure scene — a diagram drawn from data the article declared.
 *
 * The `wire` accent lives here and nowhere else: this is the DDR-derived
 * numeric information the brand treats as its own content class. Nothing is
 * inferred at render time; every number on screen came from the frontmatter and
 * was reviewed in a pull request.
 */
export function FigureScene({ scene, orientation }: SceneProps) {
  const frame = useCurrentFrame();
  const { width: frameWidth } = useVideoConfig();
  const l = layout(orientation);
  const figure = scene.figure;

  if (!figure) return <AbsoluteFill style={TRANSPARENT} />;

  /** Rows arrive one after another, in the order they are read. */
  const rowProgress = (index: number) => easeOut((frame - index * 4) / 12);

  // `visualLength` weights a CJK glyph as two, so this is the longest value in
  // the figure measured the way it will occupy the frame.
  const widest =
    figure.kind === 'stat'
      ? Math.max(...figure.items.map((item) => visualLength(item.value)))
      : 1;

  // A vertical frame takes two stats side by side; a landscape one takes the
  // whole row. A word-shaped value (`パネル別`, not `300`) needs a wider column
  // than that, or the whole row shrinks to fit its longest member.
  const maxColumns =
    orientation === 'vertical' ? (widest > 5 ? 1 : 2) : widest > 5 ? 2 : 4;
  const statColumns = figure.kind === 'stat' ? Math.min(figure.items.length, maxColumns) : 1;
  const columnWidth =
    (frameWidth - l.padding * 2 - gap.lg * (statColumns - 1)) / statColumns;

  /**
   * The size every stat value in this figure is set at.
   *
   * A big number is the point of a stat figure, but `パネル別` at display size
   * runs off the frame. A glyph is roughly 0.55em wide at the `visualLength`
   * weighting, so this is the largest size the longest value still fits its
   * column at — never larger than the format's display size.
   *
   * One size for the whole row: fitting each value to its own width would set
   * `18` larger than `300` and read as emphasis nobody asked for.
   */
  const valueSize = Math.min(
    orientation === 'vertical' ? type.h1 : type.display,
    columnWidth / Math.max(widest * 0.55, 1),
  );

  return (
    <AbsoluteFill style={TRANSPARENT}>
      <PanelGrid opacity={0.1} />
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={caption(scene)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: gap.lg }}>
          {figure.kind === 'stat' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${statColumns}, 1fr)`,
                gap: gap.lg,
              }}
            >
              {figure.items.map((entry, index) => {
                const progress = rowProgress(index);
                return (
                  <div
                    key={entry.label}
                    style={{
                      borderTop: `8px solid ${color.fg}`,
                      paddingTop: gap.md,
                      opacity: progress,
                      transform: `translateY(${(1 - progress) * 16}px)`,
                    }}
                  >
                    <p style={{ ...textStyles.meta, color: color.muted, margin: 0 }}>
                      {entry.label}
                    </p>
                    <p
                      style={{
                        ...textStyles.display,
                        fontSize: valueSize,
                        color: color.accent,
                        margin: 0,
                        letterSpacing: `${tracking.headline}em`,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {entry.value}
                    </p>
                    {entry.note ? (
                      <p style={{ ...textStyles.meta, color: color.muted, margin: 0 }}>
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {figure.kind === 'bars'
            ? (() => {
                const fractions = barFractions(figure);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: gap.md }}>
                    {figure.items.map((entry, index) => {
                      const progress = rowProgress(index);
                      return (
                        <div key={entry.label} style={{ opacity: progress }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                              gap: gap.md,
                              marginBottom: gap.xs,
                            }}
                          >
                            <span
                              style={{
                                ...textStyles.body,
                                // A label that wraps collides with its own
                                // value, so it is held to one line and cut.
                                // The vertical frame is narrow enough to need a
                                // step down as well.
                                fontSize: orientation === 'vertical' ? type.small : type.base,
                                fontWeight: entry.highlight ? fontWeight.black : fontWeight.medium,
                                letterSpacing: `${tracking.headline}em`,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {entry.label}
                            </span>
                            <span
                              style={{
                                ...textStyles.meta,
                                color: entry.highlight ? color.accent : color.muted,
                                fontVariantNumeric: 'tabular-nums',
                                flexShrink: 0,
                              }}
                            >
                              {formatBarValue(figure, entry.value)}
                            </span>
                          </div>
                          <div style={{ height: 18, background: color.line }}>
                            <div
                              style={{
                                // Bars grow to their true proportion; the reveal
                                // scales the drawn length, never the value.
                                width: `${(fractions[index] ?? 0) * 100 * progress}%`,
                                height: '100%',
                                background: entry.highlight ? color.accent : color.fg,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            : null}

          {figure.kind === 'plays' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr max-content', columnGap: gap.md }}>
              {figure.items.map((entry, index) => {
                const progress = rowProgress(index);
                // Twelve rows have to fit above the rail; the row shrinks
                // before the frame overflows.
                const dense = figure.items.length > 6;
                const size = dense ? type.small : type.base;
                return (
                  <div
                    key={`${entry.song}-${index}`}
                    style={{
                      gridColumn: '1 / -1',
                      display: 'grid',
                      gridTemplateColumns: 'subgrid',
                      alignItems: 'center',
                      padding: `${dense ? gap.xs : gap.sm}px 0`,
                      borderBottom: `2px solid ${color.line}`,
                      opacity: progress,
                      transform: `translateX(${(1 - progress) * 12}px)`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: size * 0.62,
                        fontWeight: fontWeight.bold,
                        letterSpacing: `${tracking.wider}em`,
                        padding: `${gap.xs * 0.6}px ${gap.sm}px`,
                        background: difficulty[entry.difficulty],
                        color: color.onAccent,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {difficultyLabel(entry)}
                    </span>
                    <span style={{ minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          ...textStyles.body,
                          fontSize: size,
                          fontWeight: entry.highlight ? fontWeight.black : fontWeight.medium,
                          letterSpacing: `${tracking.headline}em`,
                        }}
                      >
                        {entry.song}
                      </span>
                      {entry.note ? (
                        <span style={{ ...textStyles.meta, marginLeft: gap.sm, color: color.muted }}>
                          {entry.note}
                        </span>
                      ) : null}
                    </span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          fontFamily: font.mono,
                          fontSize: size,
                          fontWeight: entry.highlight ? fontWeight.bold : fontWeight.medium,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatScore(entry.score)}
                      </span>
                      {entry.rank ? (
                        <span
                          style={{
                            ...textStyles.meta,
                            marginLeft: gap.sm,
                            fontWeight: fontWeight.bold,
                            color: entry.rank === 'AAA' ? color.accent : color.muted,
                          }}
                        >
                          {entry.rank}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {figure.kind === 'timeline' ? (
            // One grid for the whole timeline rather than one per row, so the
            // `at` column is a single width down the list. Per-row grids size
            // to their own content and leave a ragged left edge.
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'max-content 1fr',
                columnGap: gap.md,
              }}
            >
              {figure.items.map((entry, index) => {
                const progress = rowProgress(index);
                return (
                  <div
                    key={`${entry.at}-${entry.label}`}
                    style={{
                      gridColumn: '1 / -1',
                      display: 'grid',
                      gridTemplateColumns: 'subgrid',
                      paddingBottom: gap.md,
                      borderLeft: `4px solid ${entry.highlight ? color.accent : color.lineStrong}`,
                      paddingLeft: gap.md,
                      opacity: progress,
                      transform: `translateX(${(1 - progress) * 12}px)`,
                    }}
                  >
                    <span
                      style={{
                        ...textStyles.meta,
                        color: entry.highlight ? color.accent : color.muted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {entry.at}
                    </span>
                    <span>
                      <span
                        style={{
                          ...textStyles.body,
                          fontSize: type.base,
                          fontWeight: entry.highlight ? fontWeight.black : fontWeight.medium,
                          letterSpacing: `${tracking.headline}em`,
                        }}
                      >
                        {entry.label}
                      </span>
                      {entry.note ? (
                        <span
                          style={{ ...textStyles.meta, display: 'block', color: color.muted }}
                        >
                          {entry.note}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}

          {figure.caption ? (
            <p style={{ ...textStyles.meta, color: color.muted, margin: 0 }}>
              {figure.caption}
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
 * The source card.
 *
 * Non-negotiable in the sequence: a STEPWIRE video always says where the story
 * came from, in the same way the article always lists its sources.
 */
export function SourceScene({ scene, orientation }: SceneProps) {
  const l = layout(orientation);
  const enter = useEnter(10);

  return (
    <AbsoluteFill style={TRANSPARENT}>
      <ScanLines opacity={0.04} />
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={caption(scene)} />

        <div style={enter}>
          <div style={{ height: 8, width: '100%', background: color.accent, marginBottom: gap.lg }} />
          <p style={{ ...textStyles.meta, color: color.muted, margin: 0 }}>{scene.label}</p>
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
          <p style={{ ...textStyles.meta, color: color.muted, marginTop: gap.md }}>
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
    <AbsoluteFill style={TRANSPARENT}>
      <PanelGrid opacity={0.14} stroke={color.fg} />
      <ScanLines opacity={0.08} />
      <Card background="transparent" padding={l.padding}>
        <div />
        <div style={{ textAlign: 'center', opacity: enter }}>
          <span
            style={{
              ...textStyles.display,
              display: 'block',
              fontSize: l.wordmark,
              color: color.fg,
            }}
          >
            STEP<span style={{ color: color.accent }}>WIRE</span>
          </span>
          <p
            style={{
              fontFamily: font.mono,
              fontSize: type.base,
              fontWeight: fontWeight.regular,
              letterSpacing: `${tracking.wider}em`,
              textTransform: 'uppercase',
              color: color.muted,
              marginTop: gap.md,
            }}
          >
            {scene.meta}
          </p>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: gap.md }}>
            {(['left', 'down', 'up', 'right'] as const).map((direction, index) => (
              <Arrow
                key={direction}
                direction={direction}
                size={type.h3}
                fill={index % 2 === 0 ? color.fg : color.accent}
                style={{ opacity: easeOut((frame - 6 - index * 3) / 10) }}
              />
            ))}
          </div>
          {/* Credits on the card, not only in a description: an attribution
              licence asks for them where a viewer can find them. */}
          {scene.credits ? (
            <div style={{ marginTop: gap.lg, opacity: enter }}>
              {scene.credits.map((line) => (
                <p key={line} style={{ ...textStyles.meta, fontSize: type.micro, color: color.faint, margin: 0 }}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

/**
 * The narration scene — a page of subtitles carried by the speaker's own voice.
 *
 * The word being spoken right now is marked. This is the one moment in the
 * system where the video is not a rendering of the article's prose but of the
 * recording itself, so the treatment is deliberately plain: no motion, no
 * decoration, nothing competing with the voice. The type is the subtitle, and
 * the highlight is the only thing that moves.
 */
export function NarrationScene({ scene, orientation }: SceneProps) {
  const l = layout(orientation);

  return (
    <AbsoluteFill style={TRANSPARENT}>
      <ScanLines opacity={0.035} />
      <Card background="transparent" padding={l.padding}>
        {/* The speaker's name, not a section label: this card is the voice —
            typed, not played. The recording was the script. */}
        <WireBar meta={scene.meta ?? 'STEPWIRE'} />

        <div style={{ margin: 'auto 0' }}>
          <div style={{ width: 96, height: 8, background: color.accent, marginBottom: gap.lg }} />
          <Typed
            scene={scene}
            style={{
              ...textStyles.body,
              fontSize: l.body,
              fontWeight: fontWeight.bold,
              maxWidth: l.maxWidth,
              lineHeight: leading.tight,
            }}
          />
        </div>

        <ProgressRail index={scene.index} total={scene.total} />
      </Card>
    </AbsoluteFill>
  );
}

/**
 * An image the article carries, full-bleed, with its credit.
 *
 * The credit is not optional and not small enough to miss: a jacket or a post
 * in a published video is a quotation, and the line under it is what makes it
 * one.
 */
export function ImageScene({ scene, orientation }: SceneProps) {
  const l = layout(orientation);
  const enter = useEnter(8, 0);
  const image = scene.image;

  return (
    <AbsoluteFill style={TRANSPARENT}>
      <Card background="transparent" padding={l.padding}>
        <WireBar meta={image?.kind?.toUpperCase()} />

        {/* Caption and credit on a solid band, not on the picture: a post
            screenshot always has text near its bottom edge. */}
        <div
          style={{
            ...enter,
            background: `${color.deep}EB`,
            borderLeft: `8px solid ${color.accent}`,
            padding: `${gap.md}px ${gap.lg}px`,
            // Anchored just above the rail, where the canvas renderer puts it:
            // a band mid-frame sits across whatever the picture is showing.
            margin: `auto -${l.padding}px ${gap.lg}px`,
            paddingLeft: l.padding + gap.md,
          }}
        >
          {scene.text ? (
            <p
              style={{
                ...textStyles.body,
                fontSize: type.h4,
                fontWeight: fontWeight.bold,
                color: color.fg,
                maxWidth: l.maxWidth,
                margin: `0 0 ${gap.sm}px`,
              }}
            >
              {scene.text}
            </p>
          ) : null}
          <p style={{ ...textStyles.meta, color: color.accent, margin: 0 }}>{scene.meta}</p>
        </div>

        <ProgressRail index={scene.index} total={scene.total} />
      </Card>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------

/** Scene type → component. Adding a scene type means adding one entry here. */
export const SCENE_COMPONENTS: Record<Scene['type'], React.FC<SceneProps>> = {
  headline: HeadlineScene,
  news: NewsScene,
  context: ContextScene,
  impact: ImpactScene,
  figure: FigureScene,
  source: SourceScene,
  outro: OutroScene,
  narration: NarrationScene,
  image: ImageScene,
};
