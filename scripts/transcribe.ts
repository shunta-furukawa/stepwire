/**
 * Transcribes an article's narration.
 *
 *   pnpm narration:transcribe <slug>
 *   pnpm narration:transcribe <slug> --model large-v3-turbo
 *
 * Runs Whisper.cpp locally: no API, no per-minute cost, no vendor. That matters
 * beyond the money — `lib/ai/README.md` says collection, editing, publishing and
 * rendering must all keep working with AI absent, and a transcription step that
 * depends on someone's paid endpoint is a dependency, not a boundary.
 *
 * The output is committed at `content/transcripts/<slug>.json` and is **meant to
 * be edited**. Whisper mishears DDR jargon constantly — song titles, chart
 * names, "DDR WORLD" — and this file is the subtitle track a viewer reads. Fix
 * it by hand; that is the workflow, not a failure of it.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
  type WhisperModel,
} from '@remotion/install-whisper-cpp';
import { getArticles } from '../lib/content/loader';
import { transcriptPath, type Transcript } from '../lib/content/narration';

/** Pinned so a transcript is reproducible rather than "whatever was current". */
const WHISPER_VERSION = '1.5.5';
const WHISPER_DIR = path.join(process.cwd(), '.whisper');

/**
 * `large-v3-turbo` is the smallest model that handles Japanese well enough to
 * be worth correcting rather than rewriting. `medium` is the fallback on a
 * machine short of memory; the smaller English-oriented models are not useful
 * for Japanese and are not offered as a default.
 */
const DEFAULT_MODEL: WhisperModel = 'large-v3-turbo';

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`);
  const value = index === -1 ? undefined : argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

/**
 * Whisper.cpp only reads 16 kHz mono WAV, so any other container has to be
 * converted first. Remotion ships an ffmpeg binary, which avoids asking the
 * operator to install one.
 */
async function toWav(input: string): Promise<string> {
  const { execSync } = await import('node:child_process');
  const output = path.join(WHISPER_DIR, `${path.basename(input)}.16k.wav`);
  await mkdir(WHISPER_DIR, { recursive: true });

  const ffmpeg = 'npx --yes remotion ffmpeg';
  execSync(`${ffmpeg} -y -i "${input}" -ar 16000 -ac 1 -c:a pcm_s16le "${output}"`, {
    stdio: 'ignore',
  });
  return output;
}

async function audioDurationInSeconds(wavPath: string): Promise<number> {
  // A 16-bit mono 16 kHz WAV is 32000 bytes per second after the 44-byte header.
  const { size } = await import('node:fs/promises').then((fs) => fs.stat(wavPath));
  return Math.max(0.1, (size - 44) / 32000);
}

async function main() {
  const argv = process.argv.slice(2);
  const slug = argv.find((arg) => !arg.startsWith('--'));
  const model = (flag(argv, 'model') ?? DEFAULT_MODEL) as WhisperModel;
  const language = flag(argv, 'language') ?? 'ja';

  const articles = await getArticles();

  if (!slug) {
    console.error('\nusage: pnpm narration:transcribe <slug> [--model large-v3-turbo] [--language ja]\n');
    console.error('articles with a recording:');
    for (const article of articles.filter((item) => item.narration)) {
      console.error(`  ${article.slug}  ${article.narration!.audio}`);
    }
    console.error('');
    process.exit(1);
  }

  const article = articles.find((item) => item.slug === slug);
  if (!article) {
    console.error(`\nerror: no published article with slug "${slug}"\n`);
    process.exit(1);
  }
  if (!article.narration) {
    console.error(
      `\nerror: ${slug} has no "narration.audio" in its frontmatter.\n` +
        '       Put the recording in public/audio/ and reference it there first.\n',
    );
    process.exit(1);
  }

  const audioPath = path.join(
    process.cwd(),
    'public',
    article.narration.audio.replace(/^\//, ''),
  );

  try {
    await readFile(audioPath);
  } catch {
    console.error(`\nerror: recording not found at ${path.relative(process.cwd(), audioPath)}\n`);
    process.exit(1);
  }

  console.log(`
  article  ${article.title}
  audio    ${article.narration.audio}
  model    ${model}
  language ${language}
`);

  console.log('  installing whisper.cpp (first run only, this takes a while)');
  await installWhisperCpp({ to: WHISPER_DIR, version: WHISPER_VERSION });

  console.log(`  downloading model ${model} (first run only)`);
  await downloadWhisperModel({ model, folder: WHISPER_DIR });

  console.log('  converting audio to 16kHz mono wav');
  const wavPath = await toWav(audioPath);
  const durationInSeconds = await audioDurationInSeconds(wavPath);

  console.log(`  transcribing ${durationInSeconds.toFixed(1)}s of audio`);
  const result = await transcribe({
    inputPath: wavPath,
    whisperPath: WHISPER_DIR,
    whisperCppVersion: WHISPER_VERSION,
    model,
    modelFolder: WHISPER_DIR,
    // Word-level timings are the whole point: they are what makes the subtitle
    // and the scene changes follow the voice.
    tokenLevelTimestamps: true,
    language: language as Parameters<typeof transcribe>[0]['language'],
    onProgress: (progress) => {
      const percent = Math.round(progress * 100);
      if (percent % 20 === 0) console.log(`  ${percent}%`);
    },
  });

  const { captions } = toCaptions({ whisperCppOutput: result });

  const transcript: Transcript = {
    version: 1,
    language,
    durationInSeconds: Number(durationInSeconds.toFixed(3)),
    captions,
  };

  const outPath = transcriptPath(slug);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(transcript, null, 2)}\n`, 'utf8');

  console.log(`
  ${captions.length} caption(s) written to content/transcripts/${slug}.json

  next:
    1. read it and fix what Whisper misheard — song titles and DDR jargon especially
    2. pnpm video:render ${slug}
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
