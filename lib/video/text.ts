/**
 * Text shaping for video headlines.
 *
 * Pure string logic, so it lives beside the rest of the scene derivation rather
 * than inside the renderer — and can be tested without rendering.
 */

const CJK_RANGE = /[\u3000-\u303F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uFF00-\uFFEF]/;
const CJK_CLOSING = /[、。！？，・）」』】]/;

/**
 * Text length weighted by how much room it actually takes.
 *
 * A CJK glyph fills its em box; a Latin character averages about half of one.
 * So the same character count is roughly twice as much text on screen — and
 * twice as long to read — in Japanese as in English. Counting CJK characters
 * twice gives one measure that both the card budget and the reading-time
 * estimate can use, so neither has to know which language it is looking at.
 */
export function visualLength(text: string): number {
  let length = 0;
  for (const character of text) {
    length += CJK_RANGE.test(character) ? 2 : 1;
  }
  return length;
}


/**
 * Splits a headline into reveal units.
 *
 * Latin splits on spaces. Japanese has none, so a whole headline would arrive
 * as one block and the reveal would read as a plain fade. Splitting after
 * closing punctuation and then at each kanji/katakana → hiragana boundary
 * approximates bunsetsu — the phrase units a reader actually takes in at once.
 *
 *   "【SAMPLE】DDR WORLD、夏のアップデートでスコア表示を刷新"
 *   → 【SAMPLE】· DDR · WORLD、· 夏の · アップデートで · スコア表示を · 刷新
 */
export function splitForReveal(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => token.split(new RegExp(`(?<=${CJK_CLOSING.source})`)))
    .flatMap((piece) =>
      CJK_RANGE.test(piece)
        ? (piece.match(/[^\u3040-\u309F]+[\u3040-\u309F]*|[\u3040-\u309F]+/g) ?? [piece])
        : [piece],
    )
    .filter((piece) => piece.length > 0);
}

/** True when a word space belongs between two reveal units. */
export function needsSpaceBetween(current: string, next: string | undefined): boolean {
  if (!next) return false;
  return !CJK_RANGE.test(current.slice(-1)) && !CJK_RANGE.test(next.charAt(0));
}

/**
 * Lines a text will take in a column, estimated from weighted length: a CJK
 * glyph is an em, a Latin character about half of one. The DOM cannot measure
 * before it lays out, so it estimates; the canvas measures exactly. Both err
 * on the side of one line too many, which is the side a card can afford.
 */
export function estimateLines(text: string, size: number, measure: number): number {
  const halfEmsPerLine = Math.max(1, Math.floor(measure / (size * 0.5)));
  return text
    .split('\n')
    .reduce((lines, para) => lines + Math.max(1, Math.ceil(visualLength(para) / halfEmsPerLine)), 0);
}

export interface FitOptions {
  /** The size the card would like to set the copy at. */
  size: number;
  /** Column width in the same units as `size`. */
  measure: number;
  /** Vertical room for the copy, same units. */
  height: number;
  /** Line height as a multiple of `size`. */
  lineHeight: number;
  /** How far the copy may shrink, as a fraction of `size`. */
  floor?: number;
}

/**
 * The largest size at which the copy fits its room, stepping down from the
 * wanted size. A card whose copy runs through the progress rail is a broken
 * frame, and the operator finds out after posting; a card set a size smaller
 * is a card. The floor stops a paragraph that could never fit from shrinking
 * to nothing — past it, the writing is the problem, not the type.
 */
export function fitBodySize(text: string, options: FitOptions): number {
  const { size, measure, height, lineHeight, floor = 0.6 } = options;
  let candidate = size;
  while (
    candidate > size * floor &&
    estimateLines(text, candidate, measure) * candidate * lineHeight > height
  ) {
    candidate *= 0.92;
  }
  return Math.max(candidate, size * floor);
}
