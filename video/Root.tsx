import React from 'react';
import { Composition } from 'remotion';
import { COMPOSITIONS, COMPOSITION_IDS } from '../lib/video/compositions';
import {
  StepwireVideo,
  calculateStepwireMetadata,
  type StepwireVideoProps,
} from './compositions/StepwireVideo';
import { SAMPLE_ARTICLE } from './defaultProps';

/**
 * The Remotion root.
 *
 * Both compositions are registered from the same registry the website and the
 * render API read, so the three can never disagree about what exists. Width,
 * height and duration are all resolved by `calculateMetadata` from the props,
 * which is what lets the article decide how long its own video is.
 */
export const RemotionRoot: React.FC = () => (
  <>
    {COMPOSITION_IDS.map((id) => {
      const definition = COMPOSITIONS[id];
      const defaultProps: StepwireVideoProps = {
        article: SAMPLE_ARTICLE,
        composition: id,
      };

      return (
        <Composition
          key={id}
          id={definition.remotionId}
          component={StepwireVideo}
          defaultProps={defaultProps}
          calculateMetadata={calculateStepwireMetadata}
          // Placeholders: calculateMetadata overrides all four before render.
          durationInFrames={definition.fps * 30}
          fps={definition.fps}
          width={definition.width}
          height={definition.height}
        />
      );
    })}
  </>
);
