import { statSync } from 'node:fs';
import path from 'node:path';
import type { Article } from './article';
import type { ValidationIssue } from './validate';

/**
 * Size ceilings for the files an article carries.
 *
 * The repository is the archive, and every picture and track it holds is
 * cloned by every machine that builds the site and shipped in every deploy.
 * A phone photo straight off the camera roll is a megabyte; the page shows it
 * in a 900-pixel column and the film in less than half a frame, so nothing
 * above these limits is ever seen at its stored size. The gate refuses the
 * file rather than letting the repository grow by a session's worth of raw
 * captures each week — `docs/handoff.md` says how to shrink one.
 *
 * Audio is looser: a BGM track lasts minutes, but it sits under the ticks at a
 * fraction of its gain and is re-encoded twice on its way to the viewer, so
 * 128 kbps MP3 is transparent and a seven-minute track fits in eight
 * megabytes. MP3 rather than AAC because the open-source Chromium builds that
 * run the checks cannot decode AAC, and a bed that only some browsers can
 * decode is a silent film on the wrong phone.
 */
export const ASSET_LIMITS = {
  image: 400 * 1024,
  bgm: 8 * 1024 * 1024,
  musicClip: 2 * 1024 * 1024,
  narration: 40 * 1024 * 1024,
} as const;

export type AssetKind = keyof typeof ASSET_LIMITS;

export interface AssetRef {
  kind: AssetKind;
  /** Path under `public/`, without the leading slash. */
  src: string;
  /** Where in the frontmatter it came from, for the message. */
  field: string;
}

/** Every file an article points at, so one walk finds them all. */
export function articleAssets(article: Article): AssetRef[] {
  const refs: AssetRef[] = [];
  const add = (kind: AssetKind, src: string | undefined, field: string) => {
    if (src) refs.push({ kind, src: src.replace(/^\//, ''), field });
  };
  add('image', article.heroImage?.src, 'heroImage');
  add('image', article.thumbnail?.src, 'thumbnail');
  article.media.forEach((media, i) => add('image', media.src, `media[${i}]`));
  add('bgm', article.bgm?.src, 'bgm');
  article.video?.musicClips?.forEach((clip, i) => add('musicClip', clip.src, `video.musicClips[${i}]`));
  add('narration', article.narration?.audio, 'narration.audio');
  return refs;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Checks that every referenced file exists under `publicDir` and is within its
 * ceiling. Separate from `validateArticle` because that one is pure and runs
 * in tests on articles whose pictures do not exist.
 */
export function validateAssets(
  articles: readonly Article[],
  publicDir = path.join(process.cwd(), 'public'),
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const article of articles) {
    for (const ref of articleAssets(article)) {
      let size: number;
      try {
        size = statSync(path.join(publicDir, ref.src)).size;
      } catch {
        issues.push({
          level: 'error',
          filePath: article.filePath,
          message: `${ref.field}: "${ref.src}" is not in public/`,
        });
        continue;
      }
      const limit = ASSET_LIMITS[ref.kind];
      if (size > limit) {
        issues.push({
          level: 'error',
          filePath: article.filePath,
          message: `${ref.field}: "${ref.src}" is ${formatSize(size)}; the limit for a ${ref.kind} is ${formatSize(limit)} — shrink it before committing (docs/handoff.md)`,
        });
      }
    }
  }
  return issues;
}
