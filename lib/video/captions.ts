import type { TranscriptCaption } from '../content/narration';
import { visualLength } from './text';

/**
 * Groups a transcript's captions into subtitle pages.
 *
 * A library's TikTok-style caption grouper was tried first and
 * merged an entire fourteen-second take into one page: it groups tokens that
 * fall within a time window of each other, and continuous speech has no gaps
 * wide enough to break on. Correct for its purpose, wrong for subtitles.
 *
 * A page break wants to land where a *sentence* ends, not where the speaker
 * happened to breathe — so this pages on punctuation first, and only falls back
 * to a length or duration limit when a speaker runs on. Length is measured with
 * `visualLength`, the same weighted measure the card budgets use, so one number
 * describes a readable page in either script.
 */

export interface CaptionToken {
  text: string;
  fromMs: number;
  toMs: number;
}

export interface CaptionPage {
  text: string;
  startMs: number;
  endMs: number;
  tokens: CaptionToken[];
}

export interface PagingOptions {
  /** Page length in weighted characters — ~30 Japanese or ~60 Latin. */
  maxVisualLength: number;
  /** A page never lingers longer than this, however long the sentence. */
  maxDurationMs: number;
  /** A pause at least this long ends a page wherever it falls. */
  silenceBreakMs: number;
}

export const DEFAULT_PAGING: PagingOptions = {
  maxVisualLength: 60,
  maxDurationMs: 5000,
  silenceBreakMs: 700,
};

/** True when this caption ends a sentence and is a natural place to break. */
function endsSentence(text: string): boolean {
  return /[。．.！!？?]\s*$/.test(text.trim());
}

function joinCaptions(captions: TranscriptCaption[]): string {
  // Japanese carries no spaces between tokens; Latin does. Deciding per join
  // keeps a mixed transcript ("DDR WORLDの") from gaining stray spaces.
  return captions.reduce((text, caption, index) => {
    if (index === 0) return caption.text;
    const needsSpace =
      /[A-Za-z0-9]$/.test(text) && /^[A-Za-z0-9]/.test(caption.text);
    return `${text}${needsSpace ? ' ' : ''}${caption.text}`;
  }, '');
}

export function pageCaptions(
  captions: TranscriptCaption[],
  options: PagingOptions = DEFAULT_PAGING,
): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let current: TranscriptCaption[] = [];

  const flush = () => {
    if (current.length === 0) return;
    const startMs = current[0]!.startMs;
    const endMs = current.at(-1)!.endMs;
    pages.push({
      text: joinCaptions(current),
      startMs,
      endMs,
      tokens: current.map((caption) => ({
        text: caption.text,
        fromMs: caption.startMs,
        toMs: caption.endMs,
      })),
    });
    current = [];
  };

  for (const caption of captions) {
    const previous = current.at(-1);

    // A long pause is a break wherever it falls — the speaker stopped.
    if (previous && caption.startMs - previous.endMs >= options.silenceBreakMs) {
      flush();
    }

    const pending = [...current, caption];
    const tooLong = visualLength(joinCaptions(pending)) > options.maxVisualLength;
    const tooSlow =
      current.length > 0 && caption.endMs - current[0]!.startMs > options.maxDurationMs;

    if (current.length > 0 && (tooLong || tooSlow)) {
      flush();
    }

    current.push(caption);

    // Prefer to break after a completed sentence rather than mid-thought.
    if (endsSentence(caption.text)) flush();
  }

  flush();
  return pages;
}
