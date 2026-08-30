import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

/**
 * Narration: the recording an article is spoken over.
 *
 * This is the one place STEPWIRE's "one Article, two renderings" rule bends,
 * and it bends deliberately.
 *
 * Writing an article from a transcript and then rendering a silent typography
 * video sands off exactly what makes the video worth watching. So the recording
 * is not only an input to the text — it *is* the video's audio. The article and
 * the video stop being two renderings of the same prose and become two
 * renderings of the same recording: the page gets the edited written record,
 * the video gets the actual voice.
 *
 * The rule that keeps this honest:
 *
 *   **The article is the record. The recording is the performance.**
 *   They may differ in wording. They may not differ in fact.
 *
 * Sourcing still lives entirely on the article. A recording is never a source.
 */

/** Matches `Caption` from `@remotion/captions`. */
export const captionSchema = z.object({
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  timestampMs: z.number().nullable(),
  confidence: z.number().nullable(),
});

export const transcriptSchema = z
  .object({
    version: z.literal(1),
    /** BCP-47-ish language tag, for the record. */
    language: z.string().min(2),
    /** Length of the recording. Written by `pnpm narration:transcribe`. */
    durationInSeconds: z.number().positive(),
    /**
     * Word- or token-level captions with timings. Whisper mishears DDR jargon
     * routinely, so this file is committed and meant to be edited by hand — it
     * is the subtitle track a viewer will read.
     */
    captions: z.array(captionSchema).min(1),
  })
  .superRefine((transcript, ctx) => {
    const totalMs = transcript.durationInSeconds * 1000;
    const overrun = transcript.captions.find((caption) => caption.endMs > totalMs + 1);
    if (overrun) {
      // Silent truncation would desync every scene after this point.
      ctx.addIssue({
        code: 'custom',
        path: ['captions'],
        message: `caption "${overrun.text}" ends at ${overrun.endMs}ms, past the ${totalMs}ms recording`,
      });
    }

    const outOfOrder = transcript.captions.find(
      (caption, index) =>
        caption.endMs < caption.startMs ||
        (index > 0 && caption.startMs < transcript.captions[index - 1]!.startMs),
    );
    if (outOfOrder) {
      ctx.addIssue({
        code: 'custom',
        path: ['captions'],
        message: `caption "${outOfOrder.text}" is out of order or ends before it starts`,
      });
    }
  });

export type Transcript = z.infer<typeof transcriptSchema>;
export type TranscriptCaption = z.infer<typeof captionSchema>;

/** Where a slug's transcript lives. Convention, not configuration. */
export function transcriptPath(slug: string): string {
  return path.join(process.cwd(), 'content', 'transcripts', `${slug}.json`);
}

/** Repository-relative path of the audio file, as referenced from `public/`. */
export function narrationPublicPath(audio: string): string {
  return audio.startsWith('/') ? audio : `/${audio}`;
}

export async function loadTranscript(slug: string): Promise<Transcript | undefined> {
  let raw: string;
  try {
    raw = await readFile(transcriptPath(slug), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }

  const parsed = transcriptSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `content/transcripts/${slug}.json is invalid:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n')}`,
    );
  }
  return parsed.data;
}
