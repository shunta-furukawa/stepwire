import React from 'react';
import { AbsoluteFill, Audio, Sequence, Series, staticFile } from 'remotion';
import type { ArticleVideoInput } from '../../lib/content/article';
import { buildSceneSequence } from '../../lib/video/scenes';
import {
  COMPOSITIONS,
  COMPOSITION_IDS,
  getComposition,
  type CompositionId,
} from '../../lib/video/compositions';
import { SCENE_COMPONENTS } from '../scenes';
import { color, font } from '../styles/theme';

/**
 * The one composition body, shared by both formats.
 *
 * STEPWIRE_SHORT and STEPWIRE_NEWS are the same film at different aspect
 * ratios and pacing — the difference lives entirely in the derived sequence
 * (`lib/video/scenes.ts`), not in duplicated React. Adding a third format is a
 * new entry in the composition registry, not a new component tree.
 */

export type StepwireVideoProps = {
  article: ArticleVideoInput;
  composition: CompositionId;
};

export const StepwireVideo: React.FC<StepwireVideoProps> = ({ article, composition }) => {
  const definition = getComposition(composition);
  const sequence = buildSceneSequence(article, composition, definition.fps);

  return (
    <AbsoluteFill style={{ background: color.surface, fontFamily: font.display }}>
      {/*
       * The voice, mounted over exactly the span its subtitle pages occupy.
       * The ident and headline play silent before it, and the source and outro
       * after — so the recording is never clipped and never starts under the
       * logo.
       */}
      {sequence.narration ? (
        <Sequence
          from={sequence.narration.startFrame}
          durationInFrames={sequence.narration.durationInFrames}
          name="narration audio"
        >
          <Audio src={staticFile(sequence.narration.audioSrc)} />
        </Sequence>
      ) : null}

      <Series>
        {sequence.scenes.map((scene) => {
          const Component = SCENE_COMPONENTS[scene.type];
          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
              name={`${scene.index + 1}. ${scene.id}`}
            >
              <Component scene={scene} orientation={definition.orientation} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};

/**
 * Remotion `calculateMetadata` hook.
 *
 * The video's length is a property of the article, so the composition asks the
 * sequence builder how long it is instead of declaring a fixed duration. This
 * is what makes "duration comes from the scene definition" true at the Remotion
 * level and not just inside our own code.
 *
 * It also reconciles the one place this design can contradict itself. The
 * format is named twice — once by the Remotion composition being rendered, and
 * once inside the props — and a props file written for one format can be passed
 * to the other (`remotion render STEPWIRE-NEWS --props=…short.json`). The
 * composition actually being rendered wins, and the corrected props are handed
 * back so the component cannot lay out for a format it is not rendering into.
 */
export function calculateStepwireMetadata({
  props,
  compositionId,
}: {
  props: StepwireVideoProps;
  compositionId: string;
}) {
  const requested = COMPOSITION_IDS.find(
    (id) => COMPOSITIONS[id].remotionId === compositionId,
  );
  const composition = requested ?? props.composition;
  const definition = getComposition(composition);
  const sequence = buildSceneSequence(props.article, composition, definition.fps);

  return {
    props: { ...props, composition },
    durationInFrames: sequence.durationInFrames,
    fps: definition.fps,
    width: definition.width,
    height: definition.height,
  };
}
