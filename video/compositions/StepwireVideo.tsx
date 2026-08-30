import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import type { ArticleVideoInput } from '../../lib/content/article';
import { buildSceneSequence } from '../../lib/video/scenes';
import { getComposition, type CompositionId } from '../../lib/video/compositions';
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
    <AbsoluteFill style={{ background: color.offWhite, fontFamily: font.display }}>
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
 */
export function calculateStepwireMetadata({ props }: { props: StepwireVideoProps }) {
  const definition = getComposition(props.composition);
  const sequence = buildSceneSequence(props.article, props.composition, definition.fps);
  return {
    durationInFrames: sequence.durationInFrames,
    fps: definition.fps,
    width: definition.width,
    height: definition.height,
  };
}
