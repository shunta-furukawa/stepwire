import { Config } from '@remotion/cli/config';

/**
 * Remotion CLI configuration.
 *
 * Only affects `remotion studio` and `remotion render`. The programmatic render
 * path (`scripts/render-video.ts` and the render API) passes its own options,
 * so the two cannot silently disagree about codec or quality.
 */
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(null);

// H.264 in an MP4 container: the format every social platform accepts without
// re-encoding surprises.
Config.setCodec('h264');
Config.setCrf(18);

Config.setEntryPoint('video/index.ts');
